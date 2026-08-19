# Plan: Project Hub "Regularização" Tab Overhaul

Restructure the "Regularização" tab in the Project Hub to improve information organization, standardise fields, automate financial/document integration, and support structured storage for Cartório, Prefeitura, Condomínio, and Jurídico data.

## User Interface Changes

### 1. Tab Navigation & General Structure
- Update the "Regularização" tab content in `src/routes/projetos.$id.index.tsx`.
- Implement a "Salvar Alterações" button at the bottom of the tab.
- Add success notification (toast) on saving.

### 2. Cartório Section
- **Carta de Arrematação**: Dropdown (Não emitida, Em andamento, Emitida, Registrada).
- **Averbação**: Dropdown (Iniciada, Em andamento, Com pendências, Finalizada).
- **Protocolo**: Editable text field.
- **Custos de Cartório**: 
    - Auto-calculated read-only monetary field (sum of "Cartório" category expenses).
    - Document icon with tooltip "Comprovantes".
    - Click action: Navigate to Document Management filtered by Category "Cartório" and Type "Financeiro".

### 3. Prefeitura Section
- **IPTU**: Dropdown (Em aberto, Quitado).
- **Responsabilidade do IPTU**: Dropdown (Arrematante, Comprador, Proprietário, Vendedor).
- **Valor do IPTU**: Editable monetary field.
- **Transferência Cadastral**: Dropdown (Iniciada, Em andamento, Com pendências, Finalizada).
- **Valor do ITBI**: 
    - Editable monetary field.
    - Document icon with tooltip "Comprovantes".
    - Click action: Navigate to Document Management filtered by Category "Prefeitura".

### 4. Condomínio Section
- **Conditional Visibility**: Toggle "Sim/Não" next to title. Default "Não" hides all fields.
- **Débitos Anteriores**: 
    - Editable monetary field.
    - Document icon with tooltip "Comprovantes".
    - Click action: Navigate to Document Management filtered by Category "Condomínio".
- **Status dos Débitos**: Dropdown (Em aberto, Quitado).
- **Responsabilidade do Débito**: Dropdown (Arrematante, Comprador, Proprietário, Vendedor).
- **Taxa Mensal**: Editable monetary field.

### 5. Jurídico Section
- **Ação**: Dropdown with 12 specific legal action types.
- **Vara**: Editable text field.
- **Última Movimentação**: Date Picker (dd/mm/aaaa).
- **Multi-Action Support**: "Adicionar Ação" button to create new blocks of these 3 fields. Allow individual removal.

## Technical Details

- **State Management**: Use `useState` to handle form inputs and multiple legal actions within the tab.
- **Integration**:
    - Filter `despesas` by category "Cartório" for auto-calculating costs.
    - Link icons will use `useNavigate` with search params to the Documents route.
- **Components**:
    - Reuse `Select`, `Input`, `Button`, `Label` from UI library.
    - Integrate `DatePicker` component.
    - Use `lucide-react` for icons (`FileText`, `Plus`, `Trash2`).
- **Data Persistence**:
    - Since current project uses Supabase for persistence, create a new migration to store these new fields in a `regularizacao` table or add columns to `projetos`.
    - Implement a `project_actions` table for multiple legal actions.
- **Auditory**: Ensure changes are tracked (conceptually for now, with explicit data updates).

## Database Schema (Proposed)
- Add columns to `projetos` for simple fields or a new `regularizacao` table.
- Create `judicial_actions` table: `id, project_id, action_type, court, last_movement`.
