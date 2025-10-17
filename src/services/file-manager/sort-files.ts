import type { IItemFile } from './types';

/**
 * Sort files by name with optional reverse
 */
function sortFilesByName(files: IItemFile[], reverse: number = 1): void {
  files.sort((a, b) => {
    if (a.name < b.name) {
      return -1 * reverse;
    }
    if (a.name > b.name) {
      return 1 * reverse;
    }
    return 0;
  });
}

/**
 * Sort files by various criteria and handle folder positioning
 */
export function sortByMode(
  files: IItemFile[],
  sortBy: string,
  options: {
    foldersPosition: 'default' | 'top' | 'bottom';
  }
): void {
  switch (sortBy) {
    case 'name-asc':
      sortFilesByName(files);
      break;

    case 'name-desc':
      sortFilesByName(files, -1);
      break;

    case 'changed-desc':
    case 'changed-asc':
    case 'size-asc':
    case 'size-desc':
      files.sort((fileA, fileB) => {
        switch (sortBy) {
          case 'changed-desc':
          case 'changed-asc': {
            const a = fileA.stat.lastModifiedMs || 0;
            const b = fileB.stat.lastModifiedMs || 0;

            if (a === b) {
              const m = sortBy === 'changed-asc' ? 1 : -1;
              return fileA.name > fileB.name ? 1 * m : -1 * m;
            }

            return sortBy === 'changed-asc' ? a - b : b - a;
          }
          case 'size-desc':
          case 'size-asc': {
            const a = fileA.size;
            const b = fileB.size;

            return sortBy === 'size-asc' ? a - b : b - a;
          }
        }

        return 0;
      });

      break;

    default:
      sortFilesByName(files, -1);
  }

  const foldersPosition = options.foldersPosition;

  if (foldersPosition !== 'default') {
    files.sort((fileA, fileB) => {
      if (fileA.stat.isDirectory && !fileB.stat.isDirectory) {
        return foldersPosition === 'top' ? -1 : 1;
      }

      if (!fileA.stat.isDirectory && fileB.stat.isDirectory) {
        return foldersPosition === 'top' ? 1 : -1;
      }

      if (fileA.stat.isDirectory && fileB.stat.isDirectory) {
        return fileA > fileB ? 1 : -1;
      }

      return 0;
    });
  }
}
