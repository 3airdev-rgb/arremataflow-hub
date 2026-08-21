# Plan to fix syntax errors and apply visual text edits

The project is currently experiencing a parse error in `src/routes/projetos.$id.financeiro.tsx` due to unescaped JSX characters (braces) introduced in a previous visual text edit. Additionally, there appears to be a structural issue in the JSX nesting that caused the initial error reported by the user.

## Proposed Changes

### Frontend Repairs
- **Fix Syntax Errors**: Resolve the `PARSE_ERROR` in `src/routes/projetos.$id.financeiro.tsx` by properly escaping all curly braces (`{`, `}`) and other special characters within the `DialogDescription` and ensuring the JSX structure is balanced.
- **Visual Text Edit**: Update the `DialogDescription` in the "Nova movimentação" dialog to contain the literal error message text requested by the user, using proper JSX escaping for code blocks and JSON objects.
- **Verify Layout**: Ensure the "Voltar" button and "Nova movimentação" buttons are correctly positioned and functional within the `AppLayout` actions.

## Technical Details
- Use `{"{"}` and `{"}"}` or wrap large text blocks in `{\` ... \`}` template literals within JSX to prevent the compiler from interpreting them as code.
- Validate the number of closing braces for the `actions` prop and the `AppLayout` component to ensure they are balanced.
- Verify that the `FinanceiroProjeto` component compiles successfully after these changes.
