import type { ParsedWorkbook } from "@/lib/import/workbook";

type StagingStore = {
    importMap: Map<string, ParsedWorkbook>;
};

const globalForStaging = globalThis as typeof globalThis & {
    __financeImportStaging?: StagingStore;
};

const store = globalForStaging.__financeImportStaging ?? {
    importMap: new Map<string, ParsedWorkbook>(),
};

if (!globalForStaging.__financeImportStaging) {
    globalForStaging.__financeImportStaging = store;
}

export const saveStagedWorkbook = (id: string, workbook: ParsedWorkbook) => {
    store.importMap.set(id, workbook);
};

export const getStagedWorkbook = (id: string) => {
    return store.importMap.get(id) ?? null;
};

export const removeStagedWorkbook = (id: string) => {
    store.importMap.delete(id);
};
