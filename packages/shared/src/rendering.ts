export type RenderFallback<TProvider extends string = string> = {
  fallbackModel?: string | null;
  fallbackProvider?: TProvider | null;
};
