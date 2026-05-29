const DEFAULT_PLAYER_STATES = {
  r1: { x: 0.20, y: 0.15, orientation: 0 },
  r2: { x: 0.20, y: 0.30, orientation: 0 },
  r3: { x: 0.20, y: 0.50, orientation: 0 },
  r4: { x: 0.20, y: 0.70, orientation: 0 },
  r5: { x: 0.20, y: 0.85, orientation: 0 },
  r6: { x: 0.35, y: 0.35, orientation: 0 },
  r7: { x: 0.35, y: 0.65, orientation: 0 },
  b1: { x: 0.80, y: 0.15, orientation: Math.PI },
  b2: { x: 0.80, y: 0.30, orientation: Math.PI },
  b3: { x: 0.80, y: 0.50, orientation: Math.PI },
  b4: { x: 0.80, y: 0.70, orientation: Math.PI },
  b5: { x: 0.80, y: 0.85, orientation: Math.PI },
  b6: { x: 0.65, y: 0.35, orientation: Math.PI },
  b7: { x: 0.65, y: 0.65, orientation: Math.PI },
}

export function createDefaultBoardData() {
  return {
    players: [
      { id: 'r1', team: 'red',  number: 1, name: '1' },
      { id: 'r2', team: 'red',  number: 2, name: '2' },
      { id: 'r3', team: 'red',  number: 3, name: '3' },
      { id: 'r4', team: 'red',  number: 4, name: '4' },
      { id: 'r5', team: 'red',  number: 5, name: '5' },
      { id: 'r6', team: 'red',  number: 6, name: '6' },
      { id: 'r7', team: 'red',  number: 7, name: '7' },
      { id: 'b1', team: 'blue', number: 1, name: '1' },
      { id: 'b2', team: 'blue', number: 2, name: '2' },
      { id: 'b3', team: 'blue', number: 3, name: '3' },
      { id: 'b4', team: 'blue', number: 4, name: '4' },
      { id: 'b5', team: 'blue', number: 5, name: '5' },
      { id: 'b6', team: 'blue', number: 6, name: '6' },
      { id: 'b7', team: 'blue', number: 7, name: '7' },
    ],
    frames: [{
      id: 'frame-0',
      duration: 1000,
      playerStates: { ...DEFAULT_PLAYER_STATES },
      discState: { x: 0.50, y: 0.50 },
      annotations: [],
    }],
    globalAnnotations: [],
  }
}
