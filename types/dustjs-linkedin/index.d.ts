export interface Dust {
  compile(source: string, name: string): string;
  compileFn(
    source: string,
  ): (
    context: any,
    callback: (err: Error | null, html: string) => void,
  ) => void;
  render(
    templateName: string,
    context: any,
    callback: (err: Error | null, html: string) => void,
  ): void;
  filters: {
    [key: string]: (value: string) => string;
  };
}

declare const dust: Dust;
export = dust;
