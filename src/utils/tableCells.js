/**
 * The passthrough that gives a PrimeVue DataTable column's body cells their column's name as `data-label`, which the
 * phone-card layout (src/assets/style/tableCards.less) draws above each value, and names the header cell by the
 * column alone (a help button inside it would otherwise join its name): `<Column :header="h" :pt="cellLabel(h)">`.
 */
export function cellLabel(header) {
    return { bodyCell: { "data-label": header }, headerCell: { "aria-label": header } };
}
