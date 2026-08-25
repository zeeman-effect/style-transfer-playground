function dbChain(result: unknown[] = []) {
  const thenable = {
    then(
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(result).then(resolve, reject);
    },
    limit() {
      return thenable;
    },
    where() {
      return thenable;
    },
    from() {
      return thenable;
    },
    set() {
      return thenable;
    },
    values() {
      return thenable;
    },
    returning() {
      return thenable;
    },
    onConflictDoUpdate() {
      return thenable;
    },
    orderBy() {
      return thenable;
    },
  };
  return thenable;
}

export const db = {
  select: () => dbChain(),
  insert: () => dbChain(),
  update: () => dbChain(),
  delete: () => dbChain(),
};
