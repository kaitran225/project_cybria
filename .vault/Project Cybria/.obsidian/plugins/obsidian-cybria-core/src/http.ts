export function apiBase(url: string): string {
	return url.replace(/\/+$/, "");
}

export async function parseError(res: Response, fallback: string): Promise<string> {
	try {
		const err = (await res.json()) as { detail?: string };
		return err.detail ?? fallback;
	} catch {
		return fallback;
	}
}
