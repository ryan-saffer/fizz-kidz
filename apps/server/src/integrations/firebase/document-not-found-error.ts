/** Thrown by `DatabaseClient` reads of a single document that doesn't exist, e.g. a deleted booking. */
export class DocumentNotFoundError extends Error {
    constructor(path: string, id: string) {
        super(`Cannot find document at path '${path}' with id '${id}'`)
        this.name = 'DocumentNotFoundError'
    }
}
