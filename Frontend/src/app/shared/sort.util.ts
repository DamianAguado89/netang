import { Sort } from '@angular/material/sort';

/**
 * Valor comparable que un componente extrae de una fila para una columna dada.
 * `Date` cubre las columnas de fecha, que llegan del backend como string ISO.
 */
export type SortAccessor<T> = (item: T, column: string) => string | number | Date | null | undefined;

/**
 * Ordena una copia de `data` según el estado activo de `MatSort`.
 * Sin columna activa (o dirección `''`, que Material usa para "sin ordenar"),
 * devuelve una copia en el orden original — nunca muta el arreglo de entrada,
 * ya que viene de un signal `computed()` que no debe alterarse en el lugar.
 */
export function sortData<T>(data: readonly T[], sort: Sort, accessor: SortAccessor<T>): T[] {
  if (!sort.active || sort.direction === '') return [...data];

  const isAsc = sort.direction === 'asc';
  return [...data].sort((a, b) => compareValues(accessor(a, sort.active), accessor(b, sort.active), isAsc));
}

function compareValues(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
  isAsc: boolean
): number {
  if (a == null && b == null) return 0;
  if (a == null) return isAsc ? -1 : 1;
  if (b == null) return isAsc ? 1 : -1;

  if (a instanceof Date || b instanceof Date) {
    return (new Date(a).getTime() - new Date(b).getTime()) * (isAsc ? 1 : -1);
  }

  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b) * (isAsc ? 1 : -1);
  }

  return ((a as number) - (b as number)) * (isAsc ? 1 : -1);
}
