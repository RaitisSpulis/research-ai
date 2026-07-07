const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const ERROR_MESSAGES = {
  400: "Invalid request.",
  401: "Authentication is required.",
  429: "Too many requests.",
  500: "Internal server error."
};

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  Object.entries(JSON_HEADERS).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
  response.end(JSON.stringify(body));
}

function sendOk(response, body) {
  sendJson(response, 200, {
    ok: true,
    ...body
  });
}

function sendError(response, statusCode, code, message, details) {
  sendJson(response, statusCode, {
    ok: false,
    error: {
      code,
      message: message || ERROR_MESSAGES[statusCode] || ERROR_MESSAGES[500],
      details: details || null
    }
  });
}

function sendBadRequest(response, code, message, details) {
  sendError(response, 400, code || "bad_request", message || ERROR_MESSAGES[400], details);
}

function sendUnauthorized(response, code, message, details) {
  sendError(response, 401, code || "unauthorized", message || ERROR_MESSAGES[401], details);
}

function sendRateLimited(response, code, message, details) {
  sendError(response, 429, code || "rate_limited", message || ERROR_MESSAGES[429], details);
}

function sendServerError(response, code, message, details) {
  sendError(response, 500, code || "server_error", message || ERROR_MESSAGES[500], details);
}

module.exports = {
  sendBadRequest,
  sendError,
  sendJson,
  sendOk,
  sendRateLimited,
  sendServerError,
  sendUnauthorized
};
