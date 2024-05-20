import { type StateValue } from 'xstate';

export function getStateValueStrings(stateValue: StateValue): string[] {
  if (typeof stateValue === 'string') {
    return [stateValue];
  }
  const valueKeys = Object.keys(stateValue);

  return valueKeys.concat(
    ...valueKeys.map((key) =>
      getStateValueStrings(stateValue[key]!).map((s) => key + '.' + s)
    )
  );
}
