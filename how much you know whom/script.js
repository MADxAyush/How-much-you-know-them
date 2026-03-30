const QUESTIONS = [
    "Favorite color",
    "Favorite sport",
    "Favorite entertainment",
    "Favorite hobby",
    "Most used app",
    "Fictional character match",
    "Sleep schedule",
    "Favorite game",
    "Favorite festival",
    "Instrument to learn"
];

const HISTORY_KEY = "howMuchYouKnowWhom.history";
const OWNER_QUIZZES_KEY = "howMuchYouKnowWhom.ownerQuizzes";
const DEVICE_ATTEMPTS_KEY = "howMuchYouKnowWhom.deviceAttempts";

const body = document.body;
const params = new URLSearchParams(window.location.search);

const questionNumber = Number(body.dataset.question || 0);
const totalQuestions = Number(body.dataset.total || QUESTIONS.length);
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
const createOwnLink = document.getElementById("createOwnLink");
const ownerSummaryLink = document.getElementById("ownerSummaryLink");

function readObject(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || "{}");
    } catch {
        return {};
    }
}

function writeObject(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function toBase64Url(value) {
    const encoded = btoa(
        encodeURIComponent(JSON.stringify(value)).replace(
            /%([0-9A-F]{2})/g,
            (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))
        )
    );

    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = atob(padded);
    const percentEncoded = Array.from(binary, character =>
        `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`
    ).join("");

    return JSON.parse(decodeURIComponent(percentEncoded));
}

function readArray(name) {
    const value = params.get(name);

    if (!value) {
        return [];
    }

    try {
        return fromBase64Url(value);
    } catch {
        try {
            return JSON.parse(value);
        } catch {
            return [];
        }
    }
}

function readText(name) {
    return (params.get(name) || "").trim();
}

function buildUrl(page, data = {}) {
    const url = new URL(page, window.location.href);

    Object.entries(data).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
            url.searchParams.set(key, toBase64Url(value));
        } else if (typeof value === "string" && value.trim() !== "") {
            url.searchParams.set(key, value.trim());
        }
    });

    return url.toString();
}

function currentPageName() {
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] || "index.html";
}

function createQuizId() {
    return `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createAttemptId() {
    return `play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveHistory(entry) {
    const history = readHistory();

    if (history.some(item => item.id === entry.id)) {
        return;
    }

    history.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

function readOwnedQuiz(activeQuizId) {
    const ownedQuizzes = readObject(OWNER_QUIZZES_KEY);
    return activeQuizId ? ownedQuizzes[activeQuizId] || null : null;
}

function saveOwnedQuiz(entry) {
    if (!entry?.quizId || !Array.isArray(entry.answers) || entry.answers.length !== totalQuestions) {
        return;
    }

    const ownedQuizzes = readObject(OWNER_QUIZZES_KEY);
    ownedQuizzes[entry.quizId] = {
        quizId: entry.quizId,
        ownerName: entry.ownerName || "Unknown",
        answers: entry.answers,
        updatedAt: new Date().toISOString()
    };
    writeObject(OWNER_QUIZZES_KEY, ownedQuizzes);
}

function readDeviceAttempt(activeQuizId) {
    const attempts = readObject(DEVICE_ATTEMPTS_KEY);
    return activeQuizId ? attempts[activeQuizId] || null : null;
}

function saveDeviceAttempt(entry) {
    if (!entry?.quizId) {
        return;
    }

    const attempts = readObject(DEVICE_ATTEMPTS_KEY);

    if (!attempts[entry.quizId]) {
        attempts[entry.quizId] = entry;
        writeObject(DEVICE_ATTEMPTS_KEY, attempts);
    }
}

function formatQuizOwner(ownerName) {
    return ownerName ? `${ownerName}'s quiz` : "this quiz";
}

function historyForQuiz(activeQuizId) {
    return readHistory().filter(item => item.quizId === activeQuizId);
}

function ensureNameGate(isPlayMode, ownerName, playerName, attemptId, activeQuizId, quizAnswers, guesses, answers) {
    if (!questionNumber) {
        return false;
    }

    const hasRequiredName = isPlayMode ? Boolean(playerName) : Boolean(ownerName);

    if (hasRequiredName) {
        return false;
    }

    const overlay = document.createElement("div");
    overlay.className = "name-gate";

    const heading = isPlayMode
        ? `Enter your name to play ${formatQuizOwner(ownerName)}`
        : "Enter your name to create your quiz";
    const buttonLabel = isPlayMode ? "Start Quiz" : "Create Quiz";

    overlay.innerHTML = `
        <form class="name-card" id="nameGateForm">
            <h2>${heading}</h2>
            <p>${isPlayMode
                ? "Your result will be shown with your name."
                : "Your name will appear in the share link and result page."
            }</p>
            <input id="nameInput" type="text" maxlength="40" placeholder="Your name" autocomplete="name">
            <button type="submit">${buttonLabel}</button>
            <div class="name-error" id="nameError"></div>
        </form>
    `;

    document.body.appendChild(overlay);

    const form = document.getElementById("nameGateForm");
    const input = document.getElementById("nameInput");
    const error = document.getElementById("nameError");

    form.addEventListener("submit", event => {
        event.preventDefault();

        const enteredName = input.value.trim();

        if (!enteredName) {
            error.textContent = "Please enter your name before continuing.";
            return;
        }

        if (isPlayMode) {
            window.location.href = buildUrl(currentPageName(), {
                mode: "play",
                owner: ownerName,
                player: enteredName,
                attempt: attemptId || createAttemptId(),
                quizId: activeQuizId,
                quiz: quizAnswers,
                guesses
            });
        } else {
            window.location.href = buildUrl(currentPageName(), {
                owner: enteredName,
                quizId: activeQuizId || createQuizId(),
                answers
            });
        }
    });

    input.focus();
    return true;
}

function setQuestionMeta(isPlayMode, ownerName, playerName) {
    if (!questionCount || !questionNumber) {
        return;
    }

    questionCount.textContent = `Question ${questionNumber}/${totalQuestions}`;

    const meta = document.createElement("div");
    meta.className = "quiz-meta";

    if (isPlayMode) {
        meta.textContent = `${playerName || "A friend"} is playing ${formatQuizOwner(ownerName)}.`;
    } else if (ownerName) {
        meta.textContent = `${ownerName}, choose your own answer for this question.`;
    } else {
        meta.textContent = "Choose your own answer for this question.";
    }

    const existingMeta = document.querySelector(".quiz-meta");

    if (existingMeta) {
        existingMeta.remove();
    }

    questionCount.insertAdjacentElement("beforebegin", meta);
}

function setSharePage(ownerName, activeQuizId, answers) {
    if (quizTitle) {
        quizTitle.textContent = ownerName ? `Share ${ownerName}'s Quiz` : "Share Your Quiz";
    }

    if (answers.length !== totalQuestions) {
        if (shareStatus) {
            shareStatus.textContent = "Complete all 10 questions before sharing your quiz.";
        }

        if (shareLinkField) {
            shareLinkField.value = "";
        }

        if (shareLink) {
            shareLink.removeAttribute("href");
            shareLink.textContent = "";
        }

        return;
    }

    const quizIdToUse = activeQuizId || createQuizId();
    const playUrl = buildUrl("index.html", {
        mode: "play",
        owner: ownerName,
        quizId: quizIdToUse,
        quiz: answers
    });
    const ownerUrl = buildUrl("result.html", {
        mode: "owner",
        owner: ownerName,
        quizId: quizIdToUse,
        quiz: answers
    });

    saveOwnedQuiz({
        quizId: quizIdToUse,
        ownerName,
        answers
    });

    if (shareStatus) {
        shareStatus.textContent = ownerName
            ? `Send this URL to your friend so they can play ${ownerName}'s quiz.`
            : "Send this URL to your friend so they can play your quiz.";
    }

    if (shareLinkField) {
        shareLinkField.value = playUrl;
    }

    if (shareLink) {
        shareLink.href = playUrl;
        shareLink.textContent = "Open shared quiz";
    }

    if (ownerSummaryLink) {
        ownerSummaryLink.href = ownerUrl;
    }
}

function renderHistory(items, emptyTitle, emptyText) {
    if (!historyList) {
        return;
    }

    historyList.innerHTML = items.length > 0
        ? items.map(item => `
            <li>
                <strong>${item.playerName}</strong> scored ${item.score}/${item.total}
                <small>on ${item.ownerName}'s quiz - ${item.playedAt}</small>
            </li>
        `).join("")
        : `<li><strong>${emptyTitle}</strong><small>${emptyText}</small></li>`;
}

function setResultPage(ownerName, playerName, attemptId, activeQuizId, quizAnswers, guesses) {
    const isOwnerMode = params.get("mode") === "owner";
    const ownedQuiz = readOwnedQuiz(activeQuizId);
    const savedAttempt = readDeviceAttempt(activeQuizId);
    let quiz = quizAnswers;
    let playerGuesses = guesses;

    if (!scoreBox || !resultList) {
        return;
    }

    if (createOwnLink) {
        createOwnLink.href = "index.html";
    }

    if (isOwnerMode && quiz.length === 0 && ownedQuiz?.answers?.length) {
        quiz = ownedQuiz.answers;
    }

    if (!isOwnerMode && quiz.length === 0 && savedAttempt?.quiz?.length) {
        quiz = savedAttempt.quiz;
        playerGuesses = savedAttempt.guesses || [];
    }

    if (isOwnerMode) {
        const localAttempts = historyForQuiz(activeQuizId);

        if (quizTitle) {
            quizTitle.textContent = ownerName ? `${ownerName}'s Quiz Summary` : "Quiz Summary";
        }

        if (quizSubtitle) {
            quizSubtitle.textContent = "This page shows only scores saved on this device/browser.";
        }

        scoreBox.textContent = localAttempts.length > 0
            ? `${localAttempts.length} completed play(s) for this quiz were found on this device.`
            : "No completed plays for this quiz were found on this device yet.";

        resultList.innerHTML = quiz.map((answer, index) => `
            <li class="correct">
                <strong>Question ${index + 1}</strong>
                <span>Your saved answer</span>
                <small>${answer}</small>
            </li>
        `).join("");

        if (historyNote) {
            historyNote.textContent = "Scores from other devices are not collected in this frontend-only version.";
        }

        renderHistory(
            localAttempts,
            "No local plays yet",
            "When someone finishes this quiz on this device, it will appear here."
        );
        return;
    }

    if (quiz.length === 0 || playerGuesses.length === 0) {
        if (quizTitle) {
            quizTitle.textContent = "Your Result";
        }

        scoreBox.textContent = "No result found.";
        resultList.innerHTML = "";
        return;
    }

    let score = 0;

    const items = quiz.map((answer, index) => {
        const guess = playerGuesses[index];
        const isCorrect = guess === answer;

        if (isCorrect) {
            score += 1;
        }

        return `
            <li class="${isCorrect ? "correct" : "incorrect"}">
                <strong>Question ${index + 1}</strong>
                <span>${isCorrect ? "Correct" : "Incorrect"}</span>
                <small>Correct answer: ${answer}</small>
            </li>
        `;
    }).join("");

    if (quizTitle) {
        quizTitle.textContent = playerName ? `${playerName}'s Result` : "Your Result";
    }

    if (quizSubtitle) {
        quizSubtitle.textContent = ownerName ? `Quiz owner: ${ownerName}` : "Quiz owner: Unknown";
    }

    scoreBox.textContent = `${playerName || "You"} scored ${score} out of ${quiz.length} on ${formatQuizOwner(ownerName)}.`;
    resultList.innerHTML = items;

    saveDeviceAttempt({
        id: attemptId || createAttemptId(),
        quizId: activeQuizId,
        ownerName: ownerName || "Unknown",
        playerName: playerName || "Anonymous",
        score,
        total: quiz.length,
        quiz,
        guesses: playerGuesses,
        playedAt: new Date().toLocaleString()
    });

    saveHistory({
        id: attemptId || `${ownerName}-${playerName}-${score}-${quiz.length}`,
        quizId: activeQuizId,
        ownerName: ownerName || "Unknown",
        playerName: playerName || "Anonymous",
        score,
        total: quiz.length,
        playedAt: new Date().toLocaleString()
    });

    if (historyNote) {
        historyNote.textContent = "Only scores saved on this device are visible here in the frontend-only version.";
    }

    renderHistory(
        historyForQuiz(activeQuizId),
        "No local history yet",
        "This device will remember the completed result for this quiz."
    );
}

function redirectToStoredResultIfNeeded(isPlayMode, ownerName, activeQuizId, playerName) {
    if (!questionNumber || !activeQuizId || !isPlayMode) {
        return false;
    }

    const ownedQuiz = readOwnedQuiz(activeQuizId);
    const savedAttempt = readDeviceAttempt(activeQuizId);

    if (ownedQuiz?.answers?.length === totalQuestions && !playerName) {
        window.location.replace(buildUrl("result.html", {
            mode: "owner",
            owner: ownedQuiz.ownerName,
            quizId: activeQuizId,
            quiz: ownedQuiz.answers
        }));
        return true;
    }

    if (savedAttempt) {
        window.location.replace(buildUrl("result.html", {
            mode: "play",
            owner: savedAttempt.ownerName,
            player: savedAttempt.playerName,
            attempt: savedAttempt.id,
            quizId: activeQuizId,
            quiz: savedAttempt.quiz,
            guesses: savedAttempt.guesses
        }));
        return true;
    }

    return false;
}

const ownerName = readText("owner");
const playerName = readText("player");
const attemptId = readText("attempt");
const quizId = readText("quizId");
const quizAnswers = readArray("quiz");
const guesses = readArray("guesses");
const answers = readArray("answers");
const isPlayMode = params.get("mode") === "play" && params.has("quiz");

const redirectedToStoredResult = redirectToStoredResultIfNeeded(isPlayMode, ownerName, quizId, playerName);
const gateVisible = redirectedToStoredResult
    ? true
    : ensureNameGate(isPlayMode, ownerName, playerName, attemptId, quizId, quizAnswers, guesses, answers);

setQuestionMeta(isPlayMode, ownerName, playerName);

if (options.length > 0 && questionNumber && nextPage && !gateVisible) {
    options.forEach(option => {
        option.addEventListener("click", () => {
            const value = option.dataset.value;
            const activeQuizId = quizId || createQuizId();

            if (!value) {
                return;
            }

            if (isPlayMode) {
                const nextGuesses = [...guesses];
                const destinationPage = questionNumber === totalQuestions ? "result.html" : nextPage;

                nextGuesses[questionNumber - 1] = value;

                window.location.href = buildUrl(destinationPage, {
                    mode: "play",
                    owner: ownerName,
                    player: playerName,
                    attempt: attemptId || createAttemptId(),
                    quizId: activeQuizId,
                    quiz: quizAnswers,
                    guesses: nextGuesses
                });
                return;
            }

            const nextAnswers = [...answers];
            nextAnswers[questionNumber - 1] = value;

            window.location.href = buildUrl(nextPage, {
                owner: ownerName,
                quizId: activeQuizId,
                answers: nextAnswers
            });
        });
    });
}

if (shareLink || shareLinkField) {
    setSharePage(ownerName, quizId, answers);
}

if (copyLinkBtn) {
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

if (scoreBox && resultList) {
    setResultPage(ownerName, playerName, attemptId, quizId, quizAnswers, guesses);
}
