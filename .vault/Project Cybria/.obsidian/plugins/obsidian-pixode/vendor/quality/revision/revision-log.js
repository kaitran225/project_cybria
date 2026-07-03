export function createRevisionLog(assetId) {
    return { assetId, revisions: [], head: 0 };
}
export function createRevision(log, doc, author, message) {
    const version = log.head + 1;
    const revision = {
        version,
        timestamp: new Date().toISOString(),
        author,
        message,
        document: structuredClone(doc),
        parentVersion: log.head > 0 ? log.head : undefined,
    };
    return {
        ...log,
        revisions: [...log.revisions, revision],
        head: version,
    };
}
export function getRevision(log, version) {
    return log.revisions.find((r) => r.version === version);
}
export function getHead(log) {
    return getRevision(log, log.head);
}
export function getRegionHistory(log, regionId) {
    return log.revisions.filter((r) => r.document.regions?.some((reg) => reg.id === regionId));
}
//# sourceMappingURL=revision-log.js.map