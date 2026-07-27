/**
 * Utility function to perform fetch requests safely and parse JSON responses.
 * Prevents "Unexpected token '<', '<!doctype html>' is not valid JSON" errors
 * by validating HTTP status and Content-Type headers before attempting JSON parsing.
 */
export async function safeFetchJson<T = any>(
  url: string | URL | Request,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.toLowerCase().includes('application/json');

  if (!response.ok) {
    if (!isJson) {
      const htmlText = await response.text();
      console.error(`[safeFetchJson] O backend retornou resposta HTML (HTTP ${response.status}):`, htmlText);
      throw new Error(
        `O servidor retornou um documento HTML em vez de JSON (HTTP ${response.status}). Conteúdo HTML registrado no console.`
      );
    } else {
      const errJson = await response.json().catch(() => ({}));
      const message = errJson?.error || errJson?.message || `Erro HTTP ${response.status}: ${response.statusText}`;
      throw new Error(message);
    }
  }

  if (!isJson) {
    const rawText = await response.text();
    console.error(`[safeFetchJson] O backend retornou HTML em vez de JSON (Content-Type: ${contentType}):`, rawText);
    throw new Error(
      `O servidor backend retornou HTML/texto em vez de JSON (Content-Type: ${contentType}). O resultado HTML foi impresso no console.`
    );
  }

  return (await response.json()) as T;
}
