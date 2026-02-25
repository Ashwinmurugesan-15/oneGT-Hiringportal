/**
 * Converts a Google Drive share link to a direct view link suitable for <img> tags.
 * Supports format: https://drive.google.com/open?id=FILE_ID
 * Converts to: https://drive.google.com/uc?export=view&id=FILE_ID
 */
export const getDriveDirectLink = (url) => {
    if (!url) return '';

    // Check if it's already a direct link or not a Drive link
    if (!url.includes('drive.google.com')) return url;
    if (url.includes('uc?export=view')) return url;

    try {
        // Extract ID from URL
        let fileId = '';
        const urlObj = new URL(url);

        if (url.includes('/open')) {
            fileId = urlObj.searchParams.get('id');
        } else if (url.includes('/file/d/')) {
            // Format: https://drive.google.com/file/d/FILE_ID/view
            const parts = url.split('/file/d/');
            if (parts.length > 1) {
                fileId = parts[1].split('/')[0];
            }
        }

        if (fileId) {
            return `/api/common/drive-proxy/${fileId}`;
        }
    } catch (e) {
        console.error('Error parsing Drive URL:', e);
    }

    return url;
};
