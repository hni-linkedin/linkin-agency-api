/**
 * Same rules as GET /api/capture list: `offset` overrides page-based skip when provided.
 * @param {Record<string, string | undefined>} query - req.query
 * @returns {{ limitNum: number, effectiveSkip: number }}
 */
function parseCaptureListPagination(query) {
    const { page = 1, limit = 10, offset } = query;

    const parsePositiveInt = (v) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    };

    const parseNonNegativeInt = (v) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const limitNum = parsePositiveInt(limit);
    const offsetNum = parseNonNegativeInt(offset);
    const pageNum = parsePositiveInt(page);

    const effectiveSkip =
        offsetNum !== null
            ? offsetNum
            : (pageNum !== null && limitNum !== null ? (pageNum - 1) * limitNum : 0);

    return { limitNum: limitNum || 10, effectiveSkip };
}

module.exports = { parseCaptureListPagination };
