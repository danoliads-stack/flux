// Utility function to generate URL-friendly slugs from machine names/codes

export function generateSlug(text?: string | null): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with dashes
        .replace(/^-+|-+$/g, '')         // Trim leading/trailing dashes
        .substring(0, 50);               // Limit length
}

export function getMachineSlug(machine?: { codigo?: string | null; nome?: string | null } | null): string {
    if (!machine) return '';
    // Prefer codigo if available, fallback to nome
    const source = machine.codigo || machine.nome || '';
    return generateSlug(source);
}
