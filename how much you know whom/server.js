const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(ROOT_DIR, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const TOTAL_QUESTIONS = 10;

const CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jfif": "image/jpeg",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon"
};

function ensureDatabase() {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ quizzes: {}, attempts: {} }, null, 2));
    }
}

function readDatabase() {
    ensureDatabase();

    try {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        return JSON.parse(raw);
    } catch {
        return { quizzes: {}, attempts: {} };
    }
}

function writeDatabase(db) {
    ensureDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text) {
    res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(text);
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";

        req.on("data", chunk => {
            raw += chunk;

            if (raw.length > 1024 * 1024) {
                reject(new Error("Request body too large."));
                req.destroy();
            }
        });

        req.on("end", () => {
            if (!raw) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(raw));
            } catch {
                reject(new Error("Invalid JSON body."));
            }
        });

        req.on("error", reject);
    });
}

function generateId(prefix) {
    return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function validateAnswers(answers) {
    return Array.isArray(answers) && answers.length === TOTAL_QUESTIONS && answers.every(item => typeof item === "string" && item.trim() !== "");
}

function computeAttempt(answers, guesses) {
    const breakdown = answers.map((answer, index) => {
        const guess = guesses[index];
        return {
            questionNumber: index + 1,
            correctAnswer: answer,
            guess,
            isCorrect: guess === answer
        };
    });

    const score = breakdown.filter(item => item.isCorrect).length;

    return {
        score,
        total: answers.length,
        breakdown
    };
}

function getQuizSummary(db, quizId) {
    const quiz = db.quizzes[quizId];

    if (!quiz) {
        return null;
    }

    const attempts = (db.attempts[quizId] || []).map(attempt => ({
        id: attempt.id,
        playerName: attempt.playerName,
        score: attempt.score,
        total: attempt.total,
        createdAt: attempt.createdAt
    }));

    return {
        quizId: quiz.id,
        ownerName: quiz.ownerName,
        answers: quiz.answers,
        createdAt: quiz.createdAt,
        attempts
    };
}

function getPublicLeaderboard(db, quizId) {
    const quiz = db.quizzes[quizId];

    if (!quiz) {
        return null;
    }

    const attempts = (db.attempts[quizId] || [])
        .map(attempt => ({
            id: attempt.id,
            playerName: attempt.playerName,
            score: attempt.score,
            total: attempt.total,
            createdAt: attempt.createdAt
        }))
        .sort((first, second) => {
            if (second.score !== first.score) {
                return second.score - first.score;
            }

            return new Date(first.createdAt) - new Date(second.createdAt);
        });

    return {
        quizId: quiz.id,
        ownerName: quiz.ownerName,
        playCount: attempts.length,
        attempts
    };
}

function serveStaticFile(reqPath, res) {
    if (reqPath.startsWith("/api/") || reqPath.startsWith("/data/")) {
        sendText(res, 404, "Not found");
        return;
    }

    const relativePath = reqPath === "/" ? "/htmlfiles/index.html" : reqPath;
    const filePath = path.normalize(path.join(ROOT_DIR, relativePath));

    if (!filePath.startsWith(ROOT_DIR)) {
        sendText(res, 403, "Forbidden");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendText(res, 404, "File not found");
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        const type = CONTENT_TYPES[extension] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": type });
        res.end(content);
    });
}

async function handleApi(req, res, url) {
    const db = readDatabase();
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (req.method === "OPTIONS") {
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true, port: PORT });
        return;
    }

    if (req.method === "POST" && url.pathname === "/api/quizzes") {
        const body = await parseJsonBody(req);
        const ownerName = String(body.ownerName || "").trim();
        const answers = body.answers;

        if (!ownerName || !validateAnswers(answers)) {
            sendJson(res, 400, { error: "Owner name and 10 answers are required." });
            return;
        }

        const quizId = generateId("quiz");
        const ownerToken = generateId("owner");

        db.quizzes[quizId] = {
            id: quizId,
            ownerName,
            ownerToken,
            answers,
            createdAt: new Date().toISOString()
        };
        db.attempts[quizId] = [];
        writeDatabase(db);

        sendJson(res, 201, {
            quizId,
            ownerName,
            ownerToken
        });
        return;
    }

    if (pathParts[0] === "api" && pathParts[1] === "quizzes" && pathParts[2]) {
        const quizId = pathParts[2];
        const quiz = db.quizzes[quizId];

        if (!quiz) {
            sendJson(res, 404, { error: "Quiz not found." });
            return;
        }

        if (req.method === "GET" && pathParts.length === 3) {
            sendJson(res, 200, {
                quizId: quiz.id,
                ownerName: quiz.ownerName,
                playCount: (db.attempts[quizId] || []).length,
                questionCount: quiz.answers.length
            });
            return;
        }

        if (req.method === "GET" && pathParts[3] === "leaderboard") {
            sendJson(res, 200, {
                leaderboard: getPublicLeaderboard(db, quizId)
            });
            return;
        }

        if (req.method === "GET" && pathParts[3] === "attempt") {
            const deviceId = String(url.searchParams.get("deviceId") || "").trim();

            if (!deviceId) {
                sendJson(res, 400, { error: "deviceId is required." });
                return;
            }

            const attempt = (db.attempts[quizId] || []).find(item => item.deviceId === deviceId);

            if (!attempt) {
                sendJson(res, 404, { error: "No attempt found for this device." });
                return;
            }

            sendJson(res, 200, { attempt });
            return;
        }

        if (req.method === "POST" && pathParts[3] === "attempts") {
            const body = await parseJsonBody(req);
            const playerName = String(body.playerName || "").trim();
            const deviceId = String(body.deviceId || "").trim();
            const guesses = body.guesses;

            if (!playerName || !deviceId || !validateAnswers(guesses)) {
                sendJson(res, 400, { error: "Player name, deviceId, and 10 guesses are required." });
                return;
            }

            const existingAttempt = (db.attempts[quizId] || []).find(item => item.deviceId === deviceId);

            if (existingAttempt) {
                sendJson(res, 200, {
                    alreadyPlayed: true,
                    attempt: existingAttempt
                });
                return;
            }

            const result = computeAttempt(quiz.answers, guesses);
            const attempt = {
                id: generateId("attempt"),
                quizId,
                deviceId,
                playerName,
                guesses,
                score: result.score,
                total: result.total,
                breakdown: result.breakdown,
                createdAt: new Date().toISOString()
            };

            db.attempts[quizId].push(attempt);
            writeDatabase(db);

            sendJson(res, 201, {
                alreadyPlayed: false,
                attempt
            });
            return;
        }

        if (req.method === "GET" && pathParts[3] === "summary") {
            const ownerToken = String(url.searchParams.get("ownerToken") || "").trim();

            if (!ownerToken || ownerToken !== quiz.ownerToken) {
                sendJson(res, 403, { error: "Invalid owner token." });
                return;
            }

            sendJson(res, 200, {
                summary: getQuizSummary(db, quizId)
            });
            return;
        }
    }

    sendJson(res, 404, { error: "API route not found." });
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname.startsWith("/api/")) {
            await handleApi(req, res, url);
            return;
        }

        serveStaticFile(url.pathname, res);
    } catch (error) {
        sendJson(res, 500, { error: error.message || "Unexpected server error." });
    }
});

ensureDatabase();

server.listen(PORT, () => {
    console.log(`Quiz server running at http://localhost:${PORT}`);
});
