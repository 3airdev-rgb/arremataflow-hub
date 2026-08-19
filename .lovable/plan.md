# Plan: Automatic Project Ordering by Status Priority

Implement automatic ordering in the "Gestão de Projetos" screen based on operational status priority, followed by last update date and project code.

## User Review Required

> [!IMPORTANT]
> The ordering will be applied to both mock data and real data stored in the database. I will also unify the table view to show all projects consistently.

- The priority order is: Atrasado (1), Pendente (2), Aguardando Terceiro (3), Em Andamento (4), Não Iniciado (5), Concluído (6).
- Secondary sort: Last update date (newest first).
- Tertiary sort: Project code (ascending).

## Proposed Changes

### Database Schema
- Ensure the `status` column exists in the `projetos` table (already initiated in previous step).

### Mock Data & Constants
- Update `src/lib/mock-data.ts` to include the status priority mapping.
- Ensure all mock projects have realistic `updated_at` timestamps (or default values) to support sorting.

### Project Management UI (`src/routes/projetos.index.tsx`)
- Refactor the component to unify the display of mock projects and projects from the database into a single, cohesive table.
- Implement the sorting logic using `useMemo` to ensure it works correctly with all filters (search, stage, status).
- Update the table columns to include "Status", "Etapa", "Responsável", and "Investidores" for all projects.
- Ensure "Salvar Alterações" or status changes in other parts of the app trigger a re-fetch/update, which will automatically re-sort the list.

### Project Creation/Edit Forms
- Add the `status` selection field to `src/routes/_authenticated/projetos.novo.tsx` and `src/routes/_authenticated/projetos.$id.editar.tsx` (if it exists) to allow users to set/update project status.

## Technical Details
- **Priority Map**:
  ```typescript
  const statusPriority: Record<StatusKey, number> = {
    atrasado: 1,
    pendente: 2,
    aguardando: 3,
    andamento: 4,
    nao_iniciado: 5,
    concluido: 6,
  };
  ```
- **Sorting Logic**:
  ```typescript
  .sort((a, b) => {
    const pA = statusPriority[a.status] || 99;
    const pB = statusPriority[b.status] || 99;
    if (pA !== pB) return pA - pB;
    
    const dateA = new Date(a.updated_at).getTime();
    const dateB = new Date(b.updated_at).getTime();
    if (dateB !== dateA) return dateB - dateA;
    
    return a.codigo.localeCompare(b.codigo);
  })
  ```

## Verification Plan
1. **Automated Check**: Verify build integrity after changes.
2. **Manual Check**: Open "Gestão de Projetos" and verify the default order matches the priority map.
3. **Filter Check**: Apply "Etapa" and "Status" filters and verify the relative ordering within the filtered results remains correct.
4. **Data Update Check**: Change a project's status and verify it moves to the correct position in the list.
