// ---------------------------------------------------------------------------
// Type shim: declares @react-pdf/renderer/jsx-runtime as an alias for
// react/jsx-runtime so TypeScript accepts jsxImportSource: @react-pdf/renderer.
//
// @react-pdf/renderer uses React elements internally and does not ship its own
// jsx-runtime type declarations.  Re-exporting react/jsx-runtime satisfies
// TypeScript's TS2875 requirement while producing correct element types.
// ---------------------------------------------------------------------------

declare module "@react-pdf/renderer/jsx-runtime" {
  export * from "react/jsx-runtime";
}
