declare module "sql.js" {
  interface Database {
    exec(sql: string): QueryExecResult[];
    run(sql: string, params?: unknown[]): void;
    close(): void;
  }
  interface DatabaseConstructor {
    new (data?: ArrayBuffer): Database;
  }
  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }
  interface SqlJsStatic {
    Database: DatabaseConstructor;
  }
  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}
