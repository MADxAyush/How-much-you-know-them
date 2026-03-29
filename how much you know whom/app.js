const TOTAL_QUESTIONS = 10;

const OWNER_DRAFT_KEY = "hmykw.ownerDraft";
const OWNER_TOKEN_KEY = "hmykw.ownerTokens";
const DEVICE_ID_KEY = "hmykw.deviceId";
const PLAYER_DRAFT_PREFIX = "hmykw.playerDraft.";

const body = document.body;
const params = new URLSearchParams(window.location.search);

const questionNumber = Number(body.dataset.question || 0);
const totalQuestions = Number(body.dataset.total || TOTAL_QUESTIONS);
const nextPage = body.dataset.next || "";
const options = document.querySelectorAll(".option");

const questionCount = document.getElementById("questionCount");
const shareLink = document.getElementById("shareLink");
const shareLinkField = document.getElementById("shareLinkField");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const shareStatus = document.getElementById("shareStatus");
const quizTitle = document.getElementById("quizTitle");
const quizSubtitle = document.getElementById("quizSubtitle");
const scoreBox = document.getElementById("score");
const resultList = document.getElementById("resultList");
const historyList = document.getElementById("historyList");
const historyNote = document.getElementById("historyNote");
const historyTitle = document.querySelector(".history-box h3");
const createOwnLink = document.getElementById("createOwnLink");
const ownerSummaryLink = document.getElementById("ownerSummaryLink");

const quizId = (params.get("quiz") || "").trim();
const explicitMode = (params.get("mode") || "").trim();
const ownerTokenFromUrl = (params.get("ownerToken") || "").trim();
const SERVER_ORIGIN = "http://localhost:3000";
const IS_FILE_PROTOCOL = window.location.protocol === "file:";
const API_ORIGIN = IS_FILE_PROTOCOL ? SERVER_ORIGIN : window.location.origin;
const PUBLIC_URL_ENDPOINT = `${API_ORIGIN}/public-url.txt`;
const SHOULD_USE_PUBLIC_URL_FILE = IS_FILE_PROTOCOL || ["localhost", "127.0.0.1"].includes(window.location.hostname);

let publicBaseUrlPromise;

function readJsonStorage(storage, key, fallback) {
    try {
        const raw = storage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function writeJsonStorage(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
}

function ownerDraft() {
    return readJsonStorage(sessionStorage, OWNER_DRAFT_KEY, { ownerName: "", answers: [] });
}

function saveOwnerDraft(draft) {
    writeJsonStorage(sessionStorage, OWNER_DRAFT_KEY, draft);
}

function clearOwnerDraft() {
    sessionStorage.removeItem(OWNER_DRAFT_KEY);
}

function playerDraftKey(activeQuizId) {
    return `${PLAYER_DRAFT_PREFIX}${activeQuizId}`;
}

function readPlayerDraft(activeQuizId) {
    return readJsonStorage(sessionStorage, playerDraftKey(activeQuizId), {
        playerName: "",
        guesses: []
    });
}

function savePlayerDraft(activeQuizId, draft) {
    writeJsonStorage(sessionStorage, playerDraftKey(activeQuizId), draft);
}

function clearPlayerDraft(activeQuizId) {
    sessionStorage.removeItem(playerDraftKey(activeQuizId));
}

function readOwnerTokens() {
    return readJsonStorage(localStorage, OWNER_TOKEN_KEY, {});
}

function saveOwnerToken(activeQuizId, ownerToken) {
    const tokens = readOwnerTokens();
    tokens[activeQuizId] = ownerToken;
    writeJsonStorage(localStorage, OWNER_TOKEN_KEY, tokens);
}

function getOwnerToken(activeQuizId) {
    return readOwnerTokens()[activeQuizId] || "";
}

function getDeviceId() {
    const stored = localStorage.getItem(DEVICE_ID_KEY);

    if (stored) {
        return stored;
    }

    const deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
}

async function api(pathname, options = {}) {
    const target = pathname.startsWith("http")
        ? pathname
        : `${API_ORIGIN}${pathname}`;

    let response;

    try {
        response = await fetch(target, {
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            ...options
        });
    } catch {
        throw new Error("Cannot reach the quiz server. Start server.js and try again.");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

function pageUrl(page, extraParams = {}) {
    const base = IS_FILE_PROTOCOL
        ? window.location.href
        : `${window.location.origin}${window.location.pathname}`;
    const url = new URL(page, base);

    Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

function normalizeBaseUrl(value) {
    const trimmed = String(value || "").trim();

    if (!trimmed) {
        return "";
    }

    try {
        const url = new URL(trimmed);
        return url.origin;
    } catch {
        return "";
    }
}

function buildHostedUrl(baseUrl, pagePath, extraParams = {}) {
    const url = new URL(pagePath, `${baseUrl.replace(/\/+$/, "")}/`);

    Object.entries(extraParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });

    return url.toString();
}

async function loadPublicBaseUrl() {
    if (!SHOULD_USE_PUBLIC_URL_FILE) {
        return "";
    }

    if (!publicBaseUrlPromise) {
        publicBaseUrlPromise = (async () => {
            try {
                const response = await fetch(`${PUBLIC_URL_ENDPOINT}?ts=${Date.now()}`, {
                    cache: "no-store"
                });

                if (!response.ok) {
                    return "";
                }

                return normalizeBaseUrl(await response.text());
            } catch {
                return "";
            }
        })();
    }

    return publicBaseUrlPromise;
}

async function quizPlayUrl(activeQuizId) {
    const publicBaseUrl = await loadPublicBaseUrl();

    if (publicBaseUrl) {
        return buildHostedUrl(publicBaseUrl, "/htmlfiles/index.html", { quiz: activeQuizId });
    }

    if (IS_FILE_PROTOCOL) {
        return buildHostedUrl(SERVER_ORIGIN, "/htmlfiles/index.html", { quiz: activeQuizId });
    }

    return buildHostedUrl(window.location.origin, "/htmlfiles/index.html", { quiz: activeQuizId });
}

async function quizOwnerSummaryUrl(activeQuizId, ownerToken) {
    const publicBaseUrl = await loadPublicBaseUrl();

    if (publicBaseUrl) {
        return buildHostedUrl(publicBaseUrl, "/htmlfiles/result.html", {
            quiz: activeQuizId,
            mode: "owner",
            ownerToken
        });
    }

    return pageUrl("result.html", { quiz: activeQuizId, mode: "owner", ownerToken });
}

function showNameGate({ title, message, buttonLabel, initialValue = "", onSubmit }) {
    const overlay = document.createElement("div");
    overlay.className = "name-gate";
    overlay.innerHTML = `
        <form class="name-card" id="nameGateForm">
            <h2>${title}</h2>
            <p>${message}</p>
            <input id="nameInput" type="text" maxlength="40" placeholder="Your name" autocomplete="name" value="${initialValue}">
            <button type="submit">${buttonLabel}</button>
            <div class="name-error" id="nameError"></div>
        </form>
    `;

    document.body.appendChild(overlay);

    const form = document.getElementById("nameGateForm");
    const input = document.getElementById("nameInput");
    const error = document.getElementById("nameError");

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const value = input.value.trim();

        if (!value) {
            error.textContent = "Please enter your name before continuing.";
            return;
        }

        try {
            await onSubmit(value);
            overlay.remove();
        } catch (submitError) {
            error.textContent = submitError.message;
        }
    });

    input.focus();
}

function setQuestionMeta(text) {
    if (!questionCount || !questionNumber) {
        return;
    }

    questionCount.textContent = `Question ${questionNumber}/${totalQuestions}`;

    const oldMeta = document.querySelector(".quiz-meta");
    if (oldMeta) {
        oldMeta.remove();
    }

    if (!text) {
        return;
    }

    const meta = document.createElement("div");
    meta.className = "quiz-meta";
    meta.textContent = text;
    questionCount.insertAdjacentElement("beforebegin", meta);
}

async function loadQuizInfo(activeQuizId) {
    return api(`/api/quizzes/${activeQuizId}`);
}

async function loadExistingAttempt(activeQuizId) {
    const deviceId = getDeviceId();

    try {
        const data = await api(`/api/quizzes/${activeQuizId}/attempt?deviceId=${encodeURIComponent(deviceId)}`);
        return data.attempt;
    } catch {
        return null;
    }
}

async function createQuizOnServer() {
    const draft = ownerDraft();

    if (!draft.ownerName || draft.answers.length !== totalQuestions) {
        throw new Error("Complete all 10 answers before creating the quiz.");
    }

    const data = await api("/api/quizzes", {
        method: "POST",
        body: JSON.stringify({
            ownerName: draft.ownerName,
            answers: draft.answers
        })
    });

    saveOwnerToken(data.quizId, data.ownerToken);
    clearOwnerDraft();
    window.location.href = pageUrl("share.html", { quiz: data.quizId });
}

async function submitAttempt(activeQuizId) {
    const draft = readPlayerDraft(activeQuizId);

    if (!draft.playerName || draft.guesses.length !== totalQuestions) {
        throw new Error("Complete all 10 answers before submitting.");
    }

    await api(`/api/quizzes/${activeQuizId}/attempts`, {
        method: "POST",
        body: JSON.stringify({
            deviceId: getDeviceId(),
            playerName: draft.playerName,
            guesses: draft.guesses
        })
    });

    clearPlayerDraft(activeQuizId);
    window.location.href = pageUrl("result.html", { quiz: activeQuizId, mode: "player" });
}

async function maybeRedirectFromQuestionPage() {
    if (!questionNumber) {
        return false;
    }

    if (!quizId) {
        const draft = ownerDraft();

        if (draft.ownerName) {
            setQuestionMeta(`${draft.ownerName}, choose your own answer for this question.`);
            return false;
        }

        showNameGate({
            title: "Enter your name to create your quiz",
            message: "Your name will be used as the quiz owner's name.",
            buttonLabel: "Start Quiz",
            onSubmit: async ownerName => {
                const draftAfterName = ownerDraft();
                draftAfterName.ownerName = ownerName;
                saveOwnerDraft(draftAfterName);
                window.location.reload();
            }
        });
        return true;
    }

    const ownerToken = getOwnerToken(quizId);

    if (ownerToken) {
        window.location.replace(pageUrl("result.html", { quiz: quizId, mode: "owner" }));
        return true;
    }

    const existingAttempt = await loadExistingAttempt(quizId);
    if (existingAttempt) {
        window.location.replace(pageUrl("result.html", { quiz: quizId, mode: "player" }));
        return true;
    }

    const quizInfo = await loadQuizInfo(quizId);
    const draft = readPlayerDraft(quizId);

    if (draft.playerName) {
        setQuestionMeta(`${draft.playerName} is playing ${quizInfo.ownerName}'s quiz.`);
        return false;
    }

    showNameGate({
        title: `Enter your name to play ${quizInfo.ownerName}'s quiz`,
        message: "Your result will be saved on the server and this device will only be allowed to play once.",
        buttonLabel: "Start Quiz",
        onSubmit: async playerName => {
            savePlayerDraft(quizId, {
                ...draft,
                playerName
            });
            window.location.reload();
        }
    });
    return true;
}

function attachQuestionHandlers() {
    if (!options.length || !questionNumber || !nextPage) {
        return;
    }

    options.forEach(option => {
        option.addEventListener("click", async () => {
            const value = option.dataset.value;

            if (!value) {
                return;
            }

            if (!quizId) {
                const draft = ownerDraft();
                draft.answers[questionNumber - 1] = value;
                saveOwnerDraft(draft);

                if (questionNumber === totalQuestions) {
                    try {
                        await createQuizOnServer();
                    } catch (error) {
                        alert(error.message);
                    }
                    return;
                }

                window.location.href = nextPage;
                return;
            }

            const draft = readPlayerDraft(quizId);
            draft.guesses[questionNumber - 1] = value;
            savePlayerDraft(quizId, draft);

            if (questionNumber === totalQuestions) {
                try {
                    await submitAttempt(quizId);
                } catch (error) {
                    alert(error.message);
                }
                return;
            }

            window.location.href = pageUrl(nextPage, { quiz: quizId });
        });
    });
}

async function setupSharePage() {
    if (!shareLinkField && !shareLink) {
        return;
    }

    if (!quizId) {
        if (shareStatus) {
            shareStatus.textContent = "No quiz was found. Please create a quiz first.";
        }
        return;
    }

    const quizInfo = await loadQuizInfo(quizId);
    const ownerToken = getOwnerToken(quizId) || ownerTokenFromUrl;
    const playUrl = await quizPlayUrl(quizId);
    const summaryUrl = ownerToken
        ? await quizOwnerSummaryUrl(quizId, ownerToken)
        : pageUrl("result.html", { quiz: quizId, mode: "owner" });

    if (quizTitle) {
        quizTitle.textContent = `Share ${quizInfo.ownerName}'s Quiz`;
    }

    if (shareStatus) {
        shareStatus.textContent = `Share this clean URL so your friends can play ${quizInfo.ownerName}'s quiz from any device.`;
    }

    if (shareLinkField) {
        shareLinkField.value = playUrl;
    }

    if (shareLink) {
        shareLink.href = playUrl;
        shareLink.textContent = "Open shared quiz";
    }

    if (ownerSummaryLink) {
        ownerSummaryLink.href = summaryUrl;
    }
}

async function setupResultPage() {
    if (!scoreBox || !resultList) {
        return;
    }

    if (!quizId) {
        scoreBox.textContent = "No quiz result found.";
        return;
    }

    if (createOwnLink) {
        createOwnLink.href = "index.html";
    }

    const ownerToken = getOwnerToken(quizId) || ownerTokenFromUrl;
    const ownerMode = explicitMode === "owner" || (ownerToken && explicitMode !== "player");

    if (ownerMode) {
        try {
            const data = await api(`/api/quizzes/${quizId}/summary?ownerToken=${encodeURIComponent(ownerToken)}`);
            const summary = data.summary;

            if (quizTitle) {
                quizTitle.textContent = `${summary.ownerName}'s Quiz Summary`;
            }

            if (quizSubtitle) {
                quizSubtitle.textContent = "This page shows every completed play saved on the server for this quiz.";
            }

            scoreBox.textContent = `${summary.attempts.length} friend(s) have completed this quiz.`;
            resultList.innerHTML = summary.answers.map((answer, index) => `
                <li class="correct">
                    <strong>Question ${index + 1}</strong>
                    <span>Your answer</span>
                    <small>${answer}</small>
                </li>
            `).join("");

            if (historyNote) {
                historyNote.textContent = "These are the server-saved scores for everyone who has played your quiz.";
            }

            if (historyTitle) {
                historyTitle.textContent = "All Player Scores";
            }

            if (historyList) {
                historyList.innerHTML = summary.attempts.length > 0
                    ? summary.attempts.map(attempt => `
                        <li>
                            <strong>${attempt.playerName}</strong> scored ${attempt.score}/${attempt.total}
                            <small>${new Date(attempt.createdAt).toLocaleString()}</small>
                        </li>
                    `).join("")
                    : `<li><strong>No one has played yet</strong><small>Share the quiz link and completed plays will appear here.</small></li>`;
            }

            return;
        } catch (error) {
            scoreBox.textContent = error.message;
            return;
        }
    }

    const attempt = await loadExistingAttempt(quizId);

    if (!attempt) {
        scoreBox.textContent = "No result found for this device.";
        return;
    }

    const quizInfo = await loadQuizInfo(quizId);
    const leaderboardData = await api(`/api/quizzes/${quizId}/leaderboard`);
    const leaderboard = leaderboardData.leaderboard;

    if (quizTitle) {
        quizTitle.textContent = `${attempt.playerName}'s Result`;
    }

    if (quizSubtitle) {
        quizSubtitle.textContent = `Quiz owner: ${quizInfo.ownerName}`;
    }

    scoreBox.textContent = `${attempt.playerName} scored ${attempt.score} out of ${attempt.total} on ${quizInfo.ownerName}'s quiz.`;
    resultList.innerHTML = attempt.breakdown.map(item => `
        <li class="${item.isCorrect ? "correct" : "incorrect"}">
            <strong>Question ${item.questionNumber}</strong>
            <span>${item.isCorrect ? "Correct" : "Incorrect"}</span>
            <small>Correct answer: ${item.correctAnswer}</small>
        </li>
    `).join("");

    if (historyNote) {
        historyNote.textContent = "This quiz can be played once per device. Below is the current leaderboard for everyone who has played.";
    }

    if (historyTitle) {
        historyTitle.textContent = "Leaderboard";
    }

    if (historyList) {
        historyList.innerHTML = leaderboard.attempts.length > 0
            ? leaderboard.attempts.map((entry, index) => `
                <li>
                    <strong>#${index + 1} ${entry.playerName}</strong> scored ${entry.score}/${entry.total}
                    <small>${new Date(entry.createdAt).toLocaleString()}</small>
                </li>
            `).join("")
            : `<li><strong>No scores yet</strong><small>Be the first player on this quiz.</small></li>`;
    }
}

function attachShareActions() {
    if (!copyLinkBtn) {
        return;
    }

    copyLinkBtn.addEventListener("click", async () => {
        const valueToCopy = shareLinkField?.value || shareLink?.href || "";

        if (!valueToCopy) {
            return;
        }

        try {
            await navigator.clipboard.writeText(valueToCopy);
            copyLinkBtn.textContent = "Copied!";
        } catch {
            copyLinkBtn.textContent = "Copy failed";
        }
    });
}

async function init() {
    if (quizId && ownerTokenFromUrl) {
        saveOwnerToken(quizId, ownerTokenFromUrl);
    }

    attachShareActions();

    if (questionNumber) {
        const blocked = await maybeRedirectFromQuestionPage();
        if (!blocked) {
            attachQuestionHandlers();
        }
        return;
    }

    await setupSharePage();
    await setupResultPage();
}

init().catch(error => {
    console.error(error);

    if (scoreBox) {
        scoreBox.textContent = error.message;
    } else if (shareStatus) {
        shareStatus.textContent = error.message;
    }
});
