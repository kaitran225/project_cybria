export interface SpecValidationResult {
    ok: boolean;
    errors: Array<{
        code: string;
        path: string;
        message: string;
    }>;
}
export declare function validateSpec(data: unknown): SpecValidationResult;
//# sourceMappingURL=validate-spec.d.ts.map