export function sanitizeFilename(slug: string): string {
	return slug
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}
