declare module 'html-pdf-node' {
  export interface PDFOptions {
    format?: string;
    printBackground?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    [key: string]: any;
  }

  export interface FileInput {
    content: string;
    url?: string;
  }

  export function generatePdf(
    file: FileInput,
    options?: PDFOptions
  ): Promise<Buffer>;

  export function generatePdfs(
    files: FileInput[],
    options?: PDFOptions
  ): Promise<Buffer[]>;
}
