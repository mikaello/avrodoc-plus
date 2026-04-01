export class Parser {
  constructor(options: any);
  parse(input: string, callback: (err: Error | null, tree: any) => void): void;
}
