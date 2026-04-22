let refreshPromise = null;

async function parseJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function toApiError(response) {
  const body = await parseJsonSafely(response);
  return {
    status: response.status,
    message: body?.message ?? defaultErrorMessage(response.status),
    errorCode: body?.errorCode ?? "UNKNOWN_ERROR",
    errors: body?.errors ?? null,
  };
}

function defaultErrorMessage(status) {
  switch (status) {
    case 400:
      return "잘못된 요청입니다.";
    case 401:
      return "로그인이 필요합니다.";
    case 403:
      return "권한이 없습니다.";
    case 404:
      return "요청한 리소스를 찾을 수 없습니다.";
    case 409:
      return "중복된 요청입니다.";
    case 500:
      return "서버 오류가 발생했습니다.";
    default:
      return "오류가 발생했습니다.";
  }
}

async function tryRefreshToken() {
  const response = await fetch("/api/tokens/refresh", {
    method: "POST",
    credentials: "include",
  });
  return response.ok;
}

export async function authFetch(url, options = {}) {
  const mergedOptions = {
    credentials: "include",
    ...options,
  };

  let response = await fetch(url, mergedOptions);
  if (response.status !== 401) {
    return response;
  }

  const errorBody = await parseJsonSafely(response.clone());
  if (errorBody?.errorCode !== "TOKEN_EXPIRED") {
    return response;
  }

  if (!refreshPromise) {
    refreshPromise = tryRefreshToken().finally(() => {
      refreshPromise = null;
    });
  }

  const refreshed = await refreshPromise;
  if (!refreshed) {
    return response;
  }

  return fetch(url, mergedOptions);
}

export async function callApi(url, options = {}) {
  const response = await authFetch(url, options);
  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return { success: true };
  }

  const body = await parseJsonSafely(response);
  return body ?? { success: true };
}

export async function callPublicApi(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return { success: true };
  }

  const body = await parseJsonSafely(response);
  return body ?? { success: true };
}
