// キズナかるた の Firestore ルール（firestore.rules）を、エミュレーターで確かめるテスト。
// 本番の Firebase には一切つながない（projectId は demo- で始まる架空のもの）。
//
// 動かし方（パッケージのインストールが必要。README の kizuna-karuta の項を参照）:
//   npx firebase-tools emulators:exec --only firestore --project demo-karuta "node rules-test.mjs"
//
// 前半: アプリが実際に行う操作（index.html と同じ書き方）が通ること。
// 後半: いたずら・攻撃が止まること。
import { readFileSync } from 'node:fs';
import { test, before, after, beforeEach } from 'node:test';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const APP_ID = 'karuta-v1';
const ROOMS = `artifacts/${APP_ID}/public/data/rooms`;
const FV = firebase.firestore.FieldValue;
const CARD_IDS = Array.from({ length: 50 }, (_, i) => i + 1);

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-karuta',
    firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// ---- 道具 -------------------------------------------------------------
const dbOf = (uid) => env.authenticatedContext(uid).firestore();
const anonDb = () => env.unauthenticatedContext().firestore();
const roomRef = (db, id) => db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms').doc(id);
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// ルールを通さずに中身を見る・置く
async function adminGet(id) {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const s = await roomRef(ctx.firestore(), id).get();
    data = s.exists ? s.data() : null;
  });
  return data;
}
async function adminSet(id, data) {
  await env.withSecurityRulesDisabled(async (ctx) => { await roomRef(ctx.firestore(), id).set(data); });
}

// ---- index.html と同じ操作 --------------------------------------------
// joinOrCreateRoom（ルーム作成・入室・ランダムマッチ）
async function joinOrCreateRoom(uid, name, inputRoomId = null, isRandom = false) {
  const db = dbOf(uid);
  const roomsCollection = db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms');
  let targetRoomId = inputRoomId;
  if (isRandom) {
    const q = roomsCollection.where('status', '==', 'waiting').where('type', '==', 'random');
    const querySnapshot = await q.get();
    let validRoomId = null;
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const created = data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt;
      if (Date.now() - created <= 30 * 60 * 1000 && (data.players || []).length < 2) { validRoomId = doc.id; break; }
    }
    targetRoomId = validRoomId || Math.random().toString(36).substring(2, 8);
  } else if (!targetRoomId) {
    targetRoomId = Math.random().toString(36).substring(2, 8);
  }
  const ref = roomsCollection.doc(targetRoomId);
  await db.runTransaction(async (transaction) => {
    const roomDoc = await transaction.get(ref);
    if (!roomDoc.exists) {
      transaction.set(ref, {
        roomId: targetRoomId, status: 'waiting', hostId: uid, type: isRandom ? 'random' : 'private',
        createdAt: FV.serverTimestamp(),
        settings: { cardCount: 20 }, players: [{ uid, name, score: 0, joinedAt: Date.now() }],
        gameState: { deck: [], boardCards: [], currentCardIndex: null, readStartTime: null, correctCardId: null, bannedPlayerIds: [], resumeAt: null },
      });
    } else {
      const data = roomDoc.data();
      if (data.status !== 'waiting') throw new Error('ゲームは既に進行中です');
      const players = data.players || [];
      if (!players.some((p) => p.uid === uid)) {
        const newPlayers = [...players, { uid, name, score: 0, joinedAt: Date.now() }];
        transaction.update(ref, { players: newPlayers });
        if (isRandom && newPlayers.length === 2) {
          const cardCount = Math.min(data.settings?.cardCount || 20, 50);
          const boardCardIds = shuffle(CARD_IDS).slice(0, cardCount);
          const deck = shuffle(boardCardIds);
          transaction.update(ref, {
            status: 'playing',
            players: newPlayers.map((p) => ({ ...p, score: 0 })),
            gameState: { deck, boardCards: boardCardIds, currentCardIndex: 0, currentReadingId: deck[0], readStartTime: Date.now(), lastWinnerId: null, bannedPlayerIds: [], resumeAt: null, advanceAt: null },
          });
        }
      }
    }
  });
  return targetRoomId;
}

async function updateSettings(uid, id, newSettings) {
  const room = await adminGet(id);
  await roomRef(dbOf(uid), id).update({ settings: { ...room.settings, ...newSettings } });
}
async function transferHost(uid, id, newHostId) {
  await roomRef(dbOf(uid), id).update({ hostId: newHostId });
}
async function startGame(uid, id, cardCountOverride) {
  const room = await adminGet(id);
  const cardCount = Math.min(cardCountOverride || room.settings.cardCount || 20, 50);
  const boardCardIds = shuffle(CARD_IDS).slice(0, cardCount);
  const deck = shuffle(boardCardIds);
  await roomRef(dbOf(uid), id).update({
    status: 'playing', players: room.players.map((p) => ({ ...p, score: 0 })),
    gameState: { deck, boardCards: boardCardIds, currentCardIndex: 0, currentReadingId: deck[0], readStartTime: Date.now(), lastWinnerId: null, bannedPlayerIds: [], resumeAt: null, advanceAt: null },
  });
}
async function nextTurn(uid, id) {
  const room = await adminGet(id);
  const deck = room.gameState.deck;
  const nextIndex = room.gameState.currentCardIndex + 1;
  const ref = roomRef(dbOf(uid), id);
  if (nextIndex >= deck.length) { await ref.update({ status: 'finished', 'gameState.advanceAt': null }); return; }
  await ref.update({
    'gameState.currentCardIndex': nextIndex, 'gameState.currentReadingId': deck[nextIndex],
    'gameState.readStartTime': Date.now(), 'gameState.lastWinnerId': null,
    'gameState.bannedPlayerIds': [], 'gameState.resumeAt': null, 'gameState.advanceAt': null,
  });
}
// handleCardClick の取引（正しい札なら取る、違えばお手つき）
async function clickCard(uid, id, cardId) {
  const db = dbOf(uid);
  const ref = roomRef(db, id);
  await db.runTransaction(async (transaction) => {
    const sfDoc = await transaction.get(ref);
    if (!sfDoc.exists) throw 'Room does not exist!';
    const data = sfDoc.data();
    const currentBoard = data.gameState.boardCards;
    const currentBans = data.gameState.bannedPlayerIds || [];
    if (data.gameState.resumeAt) throw 'Game paused';
    if (currentBans.includes(uid)) throw 'You are banned';
    if (data.gameState.currentReadingId !== cardId) {
      const newBans = [...currentBans, uid];
      const updates = { 'gameState.bannedPlayerIds': newBans };
      if (newBans.length >= data.players.length) updates['gameState.resumeAt'] = Date.now() + 4000;
      transaction.update(ref, updates);
      return;
    }
    if (!currentBoard.includes(cardId)) throw 'Card already taken';
    const newBoard = currentBoard.filter((c) => c !== cardId);
    const players = data.players.map((p) => (p.uid === uid ? { ...p, score: p.score + 1 } : p));
    transaction.update(ref, {
      'gameState.boardCards': newBoard, 'gameState.lastWinnerId': uid,
      players, 'gameState.advanceAt': Date.now() + 3000,
    });
  });
}
async function clearBans(uid, id) {
  await roomRef(dbOf(uid), id).update({ 'gameState.bannedPlayerIds': [], 'gameState.resumeAt': null });
}
async function leaveRoom(uid, id) {
  const db = dbOf(uid);
  const ref = roomRef(db, id);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    if (!doc.exists) return;
    const data = doc.data();
    const newPlayers = data.players.filter((p) => p.uid !== uid);
    if (newPlayers.length === 0 || (data.type === 'private' && data.hostId === uid)) {
      transaction.delete(ref);
    } else {
      const updates = { players: newPlayers };
      if (data.hostId === uid) updates.hostId = newPlayers[0].uid;
      transaction.update(ref, updates);
    }
  });
}
async function returnToLobby(uid, id) {
  await roomRef(dbOf(uid), id).update({ status: 'waiting' });
}
// アプリの事前確認（お休み中・取られた札）を飛ばして「取る」書き込みを直接送る（攻撃のまね）
async function rawTake(uid, id) {
  const r = await adminGet(id);
  const cur = r.gameState.currentReadingId;
  await roomRef(dbOf(uid), id).update({
    'gameState.boardCards': r.gameState.boardCards.filter((c) => c !== cur),
    'gameState.lastWinnerId': uid,
    players: r.players.map((p) => (p.uid === uid ? { ...p, score: p.score + 1 } : p)),
    'gameState.advanceAt': Date.now() + 3000,
  });
}
const current = async (id) => (await adminGet(id)).gameState.currentReadingId;
const wrongCard = async (id) => { const g = (await adminGet(id)).gameState; return g.boardCards.find((c) => c !== g.currentReadingId) ?? 999; };

// =====================================================================
// 前半: アプリの操作が通る
// =====================================================================
test('プライベート部屋: 作成 → 入室 → 設定 → 開始 → 取る → 進む → 最後まで → 待機室 → 退出', async () => {
  await assertSucceeds(joinOrCreateRoom('alice', 'ありす', 'abc123'));
  await assertSucceeds(roomRef(dbOf('bob'), 'abc123').get()); // 入室前に読める
  await assertSucceeds(joinOrCreateRoom('bob', 'ぼぶ', 'abc123'));
  await assertSucceeds(joinOrCreateRoom('bob', 'ぼぶ', 'abc123')); // 2回目は何も書かない
  await assertSucceeds(updateSettings('alice', 'abc123', { cardCount: 5 }));
  await assertSucceeds(startGame('alice', 'abc123'));

  let r = await adminGet('abc123');
  for (let i = 0; i < r.gameState.deck.length; i++) {
    const who = i % 2 === 0 ? 'alice' : 'bob';
    await assertSucceeds(clickCard(who, 'abc123', await current('abc123')));
    await assertSucceeds(nextTurn('alice', 'abc123')); // 最後は status: finished
  }
  r = await adminGet('abc123');
  if (r.status !== 'finished') throw new Error('finished になっていない');
  if (r.players[0].score + r.players[1].score !== 5) throw new Error('点数の合計が合わない');

  await assertSucceeds(returnToLobby('alice', 'abc123'));
  await assertSucceeds(startGame('alice', 'abc123')); // もう一度遊べる
  await assertSucceeds(leaveRoom('bob', 'abc123'));    // 子が退出（部屋は残る）
  await assertSucceeds(leaveRoom('alice', 'abc123'));  // ホストが退出（部屋は消える）
  if (await adminGet('abc123')) throw new Error('部屋が消えていない');
});

test('お手つき: 1人 → 全員 → ホストが解除', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r1');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r1');
  await startGame('alice', 'r1');
  await assertSucceeds(clickCard('bob', 'r1', await wrongCard('r1')));
  await assertSucceeds(clickCard('alice', 'r1', await wrongCard('r1'))); // 全員お休み → resumeAt
  if (!(await adminGet('r1')).gameState.resumeAt) throw new Error('resumeAt が入っていない');
  await assertSucceeds(clearBans('alice', 'r1'));
  await assertSucceeds(clickCard('bob', 'r1', await current('r1')));
});

test('ランダムマッチ: 1人目が部屋を作り、2人目が入るとそのまま始まる', async () => {
  const id1 = await assertSucceeds(joinOrCreateRoom('alice', 'ありす', null, true));
  const id2 = await assertSucceeds(joinOrCreateRoom('bob', 'ぼぶ', null, true));
  if (id1 !== id2) throw new Error('同じ部屋に入っていない');
  const r = await adminGet(id1);
  if (r.status !== 'playing' || r.players.length !== 2) throw new Error('始まっていない');
  await assertSucceeds(clickCard('bob', id1, await current(id1)));
  await assertSucceeds(nextTurn('alice', id1));
  // ホストが抜けると、残った人がホストになる
  await assertSucceeds(leaveRoom('alice', id1));
  if ((await adminGet(id1)).hostId !== 'bob') throw new Error('ホストが引き継がれていない');
  await assertSucceeds(leaveRoom('bob', id1)); // 最後の1人 → 部屋が消える
  if (await adminGet(id1)) throw new Error('部屋が消えていない');
});

test('ランダムマッチ: 待機中の部屋で1人目がキャンセル（部屋が消える）', async () => {
  const id = await joinOrCreateRoom('alice', 'ありす', null, true);
  await assertSucceeds(leaveRoom('alice', id));
  if (await adminGet(id)) throw new Error('部屋が消えていない');
});

test('親を譲る → 新しい親が開始できる・前の親はできない', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r2');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r2');
  await assertSucceeds(transferHost('alice', 'r2', 'bob'));
  await assertFails(startGame('alice', 'r2'));
  await assertSucceeds(startGame('bob', 'r2'));
});

test('3人以上の部屋でも退出できる（真ん中の人が抜ける）', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r3');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r3');
  await joinOrCreateRoom('carol', 'きゃろる', 'r3');
  await assertSucceeds(leaveRoom('bob', 'r3'));
  const r = await adminGet('r3');
  if (r.players.map((p) => p.uid).join() !== 'alice,carol') throw new Error('退出の結果がおかしい');
});

// =====================================================================
// 後半: いたずら・攻撃が止まる
// =====================================================================
test('ログインしていない人は何もできない', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r4');
  await assertFails(roomRef(anonDb(), 'r4').get());
  await assertFails(roomRef(anonDb(), 'r4').delete());
  await assertFails(roomRef(anonDb(), 'x').set({ roomId: 'x' }));
});

test('部屋以外の場所は読めない・書けない', async () => {
  const db = dbOf('mallory');
  await assertFails(db.collection('users').doc('mallory').set({ a: 1 }));
  await assertFails(db.collection('artifacts').doc(APP_ID).set({ a: 1 }));
  await assertFails(db.collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('other').doc('x').set({ a: 1 }));
  await assertFails(db.doc(`${ROOMS}/r5/sub/x`).set({ a: 1 }));
  await assertFails(db.collection('users').get());
});

test('一覧はランダムマッチの待機中の部屋だけ', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'priv1');
  const rooms = dbOf('mallory').collection('artifacts').doc(APP_ID).collection('public').doc('data').collection('rooms');
  await assertFails(rooms.get());
  await assertFails(rooms.where('type', '==', 'private').get());
  await assertFails(rooms.where('status', '==', 'waiting').get());
  await assertSucceeds(rooms.where('status', '==', 'waiting').where('type', '==', 'random').get());
});

test('部屋の作成: 他人をホストにする・偽の参加者・余計な項目・大きすぎる値は止まる', async () => {
  const base = (uid) => ({
    roomId: 'c1', status: 'waiting', hostId: uid, type: 'private', createdAt: FV.serverTimestamp(),
    settings: { cardCount: 20 }, players: [{ uid, name: 'm', score: 0, joinedAt: Date.now() }],
    gameState: { deck: [], boardCards: [], currentCardIndex: null, readStartTime: null, correctCardId: null, bannedPlayerIds: [], resumeAt: null },
  });
  const ref = roomRef(dbOf('mallory'), 'c1');
  await assertFails(ref.set({ ...base('mallory'), hostId: 'alice' }));
  await assertFails(ref.set({ ...base('mallory'), players: [{ uid: 'alice', name: 'a', score: 0, joinedAt: 1 }] }));
  await assertFails(ref.set({ ...base('mallory'), players: [...base('mallory').players, { uid: 'fake', name: 'f', score: 0, joinedAt: 1 }] }));
  await assertFails(ref.set({ ...base('mallory'), players: [{ uid: 'mallory', name: 'm', score: 99, joinedAt: 1 }] }));
  await assertFails(ref.set({ ...base('mallory'), players: [{ uid: 'mallory', name: 'x'.repeat(31), score: 0, joinedAt: 1 }] }));
  await assertFails(ref.set({ ...base('mallory'), players: [{ uid: 'mallory', name: '', score: 0, joinedAt: 1 }] }));
  await assertFails(ref.set({ ...base('mallory'), settings: { cardCount: 1000 } }));
  await assertFails(ref.set({ ...base('mallory'), status: 'playing' }));
  await assertFails(ref.set({ ...base('mallory'), extra: 'x'.repeat(100000) }));
  await assertFails(ref.set({ ...base('mallory'), roomId: 'other' }));
  await assertFails(ref.set({ ...base('mallory'), createdAt: new Date(2099, 0, 1) })); // 期限切れにならない部屋
  await assertFails(ref.set({ ...base('mallory'), gameState: { ...base('mallory').gameState, deck: Array(1000).fill(1) } }));
  await assertSucceeds(ref.set(base('mallory')));
  // 30 文字を超える部屋 ID
  const longId = 'x'.repeat(31);
  await assertFails(roomRef(dbOf('mallory'), longId).set({ ...base('mallory'), roomId: longId }));
});

test('部屋にいない人は、書きかえ・削除ができない', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r6');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r6');
  await startGame('alice', 'r6');
  const ref = roomRef(dbOf('mallory'), 'r6');
  await assertFails(ref.delete());
  await assertFails(ref.update({ hostId: 'mallory' }));
  await assertFails(ref.update({ status: 'finished' }));
  await assertFails(ref.update({ 'gameState.bannedPlayerIds': ['alice', 'bob'] }));
  await assertFails(ref.set({ hacked: true }));
  await assertFails(clickCard('mallory', 'r6', await current('r6')));
  // ゲーム中の部屋には入れない
  await assertFails(ref.update({ players: [...(await adminGet('r6')).players, { uid: 'mallory', name: 'm', score: 0, joinedAt: 1 }] }));
});

test('入室: 自分以外を足す・何人も足す・他人を消す・点数つきで入るのは止まる', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r7');
  const players = (await adminGet('r7')).players;
  const ref = roomRef(dbOf('mallory'), 'r7');
  const me = (o = {}) => ({ uid: 'mallory', name: 'm', score: 0, joinedAt: 1, ...o });
  await assertFails(ref.update({ players: [...players, me({ uid: 'fake' })] }));
  await assertFails(ref.update({ players: [...players, me(), me({ uid: 'fake' })] }));
  await assertFails(ref.update({ players: [me()] }));                      // ホストを消して入れ替わる
  await assertFails(ref.update({ players: [...players, me({ score: 10 })] }));
  await assertFails(ref.update({ players: [...players, me()], hostId: 'mallory' }));
  await assertFails(ref.update({ players: [...players, me({ name: 'x'.repeat(31) })] }));
  await assertFails(ref.update({ players: [...players, me({ admin: true })] }));
  await assertSucceeds(ref.update({ players: [...players, me()] }));
});

test('入室: 期限切れ（30 分）の部屋には入れない', async () => {
  await adminSet('old', {
    roomId: 'old', status: 'waiting', hostId: 'alice', type: 'private',
    createdAt: firebase.firestore.Timestamp.fromMillis(Date.now() - 31 * 60 * 1000),
    settings: { cardCount: 20 }, players: [{ uid: 'alice', name: 'a', score: 0, joinedAt: 1 }],
    gameState: { deck: [], boardCards: [], currentCardIndex: null, readStartTime: null, correctCardId: null, bannedPlayerIds: [], resumeAt: null },
  });
  await assertFails(joinOrCreateRoom('bob', 'ぼぶ', 'old'));
});

test('参加者の上限は 10 人', async () => {
  await joinOrCreateRoom('p0', 'p0', 'big');
  for (let i = 1; i < 10; i++) await assertSucceeds(joinOrCreateRoom(`p${i}`, `p${i}`, 'big'));
  await assertFails(joinOrCreateRoom('p10', 'p10', 'big'));
});

test('ホストでない参加者は、ホストだけの操作ができない', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r8');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r8');
  await assertFails(updateSettings('bob', 'r8', { cardCount: 5 }));
  await assertFails(transferHost('bob', 'r8', 'bob'));
  await assertFails(startGame('bob', 'r8'));
  await startGame('alice', 'r8');
  await clickCard('alice', 'r8', await current('r8'));
  await assertFails(nextTurn('bob', 'r8'));
  await assertFails(returnToLobby('bob', 'r8'));
  await assertFails(roomRef(dbOf('bob'), 'r8').delete()); // プライベート部屋の子は消せない
});

test('ホストの操作でも、決まった形以外は止まる', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r9');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r9');
  const ref = roomRef(dbOf('alice'), 'r9');
  await assertFails(ref.update({ hostId: 'nobody' }));               // 部屋にいない人へは譲れない
  await assertFails(ref.update({ settings: { cardCount: 999 } }));
  await assertFails(ref.update({ settings: { cardCount: 10, x: 1 } }));
  await assertFails(ref.update({ type: 'random' }));
  await assertFails(ref.update({ createdAt: new Date(2099, 0, 1) })); // 期限の延長
  await assertFails(ref.update({ junk: 'x'.repeat(100000) }));
  const players = (await adminGet('r9')).players;
  await assertFails(ref.update({ players: [...players, { uid: 'fake', name: 'f', score: 0, joinedAt: 1 }] }));
  await assertFails(ref.update({ players: [players[0]] })); // 他人を追い出す
  await startGame('alice', 'r9');
  await assertFails(nextTurn('alice', 'r9')); // 誰も取っていないのに進める
  await assertFails(ref.update({ status: 'finished' }));
  await assertFails(ref.update({ 'gameState.deck': Array(1000).fill(1) }));
});

test('点数のずる: 他人の点・2点以上・取られた札・お休み中は止まる', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r10');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r10');
  await startGame('alice', 'r10');
  const r = await adminGet('r10');
  const ref = roomRef(dbOf('bob'), 'r10');
  const cur = r.gameState.currentReadingId;
  const board = r.gameState.boardCards.filter((c) => c !== cur);
  const withScore = (a, b) => [{ ...r.players[0], score: a }, { ...r.players[1], score: b }];
  await assertFails(ref.update({ players: withScore(0, 10) }));                    // 点だけ増やす
  await assertFails(ref.update({ players: withScore(5, 1), 'gameState.boardCards': board, 'gameState.lastWinnerId': 'bob', 'gameState.advanceAt': 1 })); // 他人の点
  await assertFails(ref.update({ players: withScore(0, 2), 'gameState.boardCards': board, 'gameState.lastWinnerId': 'bob', 'gameState.advanceAt': 1 })); // +2
  await assertFails(ref.update({ players: withScore(0, 1), 'gameState.boardCards': [], 'gameState.lastWinnerId': 'bob', 'gameState.advanceAt': 1 }));    // 場を全部消す
  await assertFails(ref.update({ players: withScore(0, 1), 'gameState.boardCards': board, 'gameState.lastWinnerId': 'alice', 'gameState.advanceAt': 1 })); // 取った人を偽る
  await assertFails(ref.update({ 'gameState.bannedPlayerIds': ['alice'] })); // 相手をお休みにする
  await assertSucceeds(clickCard('bob', 'r10', cur));
  await assertFails(rawTake('alice', 'r10')); // もう取られた札をもう一度取る

  // お休み中は取れない（アプリの確認を飛ばして直接書いても止まる）
  await nextTurn('alice', 'r10');
  await assertSucceeds(clickCard('bob', 'r10', await wrongCard('r10')));
  await assertFails(rawTake('bob', 'r10'));
  await assertSucceeds(rawTake('alice', 'r10'));
});

test('他人の部屋は消せない（プライベートの子・ランダムで2人いるとき）', async () => {
  await joinOrCreateRoom('alice', 'ありす', 'r11');
  await joinOrCreateRoom('bob', 'ぼぶ', 'r11');
  await assertFails(roomRef(dbOf('bob'), 'r11').delete());
  await assertFails(roomRef(dbOf('mallory'), 'r11').delete());
  const id = await joinOrCreateRoom('carol', 'c', null, true);
  await joinOrCreateRoom('dave', 'd', null, true);
  await assertFails(roomRef(dbOf('carol'), id).delete()); // ランダムは2人いれば誰も消せない（退出で抜ける）
});

// =====================================================================
// 満員（10 人）でも、確かめる回数の上限（1回の書き込みで 1000 回）を超えずに遊べる
// =====================================================================
test('10人の部屋: 入室 → 開始 → 最後の人が取る → お手つき → 次へ → 2回目の開始 → 最後の人の退出', async () => {
  const uids = Array.from({ length: 10 }, (_, i) => `u${i}`);
  for (const u of uids) await assertSucceeds(joinOrCreateRoom(u, `名前${u}`, 'full10'));
  await assertSucceeds(startGame('u0', 'full10', 5));
  await assertSucceeds(clickCard('u9', 'full10', await current('full10')));
  await assertSucceeds(nextTurn('u0', 'full10'));
  await assertSucceeds(clickCard('u8', 'full10', await wrongCard('full10')));
  await assertSucceeds(clickCard('u9', 'full10', await current('full10')));
  await assertSucceeds(returnToLobby('u0', 'full10'));
  await assertSucceeds(startGame('u0', 'full10', 5));
  await assertSucceeds(leaveRoom('u9', 'full10'));
  await assertSucceeds(leaveRoom('u5', 'full10'));
  await assertSucceeds(transferHost('u0', 'full10', 'u8'));
});

test('10人のランダムマッチ（ホスト以外が開始）とホストの退出', async () => {
  const uids = Array.from({ length: 10 }, (_, i) => `r${i}`);
  const id = await joinOrCreateRoom('r0', '名前r0', null, true);
  // 10 人そろった待機中の部屋を、ルールを通さずに用意する（前の試合の点が残っている状態）
  const room = await adminGet(id);
  await adminSet(id, { ...room, players: uids.map((u) => ({ uid: u, name: `名前${u}`, score: 3, joinedAt: Date.now() })) });
  await assertSucceeds(startGame('r9', id, 5));
  await assertSucceeds(leaveRoom('r0', id));
});
