// Firestore synchronization service
import {
    collection,
    doc,
    setDoc,
    deleteDoc,
    onSnapshot,
    query,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase.js';

async function ensureUserDoc(user) {
    if (!user || !db) return null;

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
        email: user.email || '',
        displayName: user.displayName || '',
        updatedAt: serverTimestamp()
    }, { merge: true });

    return userRef;
}

function getUserCollectionRef(collectionName) {
    const user = auth.currentUser;
    if (!user || !db) return null;
    return collection(db, 'users', user.uid, collectionName);
}

function syncUserCollection(collectionName, onUpdate) {
    const collectionRef = getUserCollectionRef(collectionName);
    const user = auth.currentUser;

    if (!collectionRef || !user) return null;

    console.log('📡 Starting Firestore sync listener for', collectionName, 'for user:', user.email);
    const collectionQuery = query(collectionRef);

    return onSnapshot(collectionQuery, (snapshot) => {
        const records = [];
        snapshot.forEach((entry) => {
            records.push({ id: entry.id, ...entry.data() });
        });
        onUpdate(records);
    }, (error) => {
        console.error(`Error syncing ${collectionName}:`, error);
    });
}

async function saveDocumentToCloud(collectionName, item) {
    const user = auth.currentUser;
    if (!user || !db || !item?.id) return;

    await ensureUserDoc(user);
    const recordRef = doc(db, 'users', user.uid, collectionName, item.id);
    await setDoc(recordRef, {
        ...item,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

async function deleteDocumentFromCloud(collectionName, itemId) {
    const user = auth.currentUser;
    if (!user || !db || !itemId) {
        console.warn(`🚫 Cannot delete ${collectionName} from cloud: No user logged in`);
        return;
    }

    const recordRef = doc(db, 'users', user.uid, collectionName, itemId);
    await deleteDoc(recordRef);
}

async function uploadCollectionData(collectionName, items) {
    const user = auth.currentUser;
    if (!user || !db) return;

    await ensureUserDoc(user);
    const batch = writeBatch(db);

    items.forEach((item) => {
        if (!item?.id) return;
        const recordRef = doc(db, 'users', user.uid, collectionName, item.id);
        batch.set(recordRef, {
            ...item,
            updatedAt: serverTimestamp()
        });
    });

    await batch.commit();
}

/**
 * Sync lots from Firestore for the current user
 */
export function syncLots(onUpdate) {
    return syncUserCollection('lots', onUpdate);
}

export function syncChurningOrders(onUpdate) {
    return syncUserCollection('churningOrders', onUpdate);
}

export function syncChurnCards(onUpdate) {
    return syncUserCollection('churnCards', onUpdate);
}

/**
 * Save or update a lot in Firestore
 */
export async function saveLotToCloud(lot) {
    await saveDocumentToCloud('lots', lot);
}

export async function saveChurningOrderToCloud(order) {
    await saveDocumentToCloud('churningOrders', order);
}

export async function saveChurnCardToCloud(card) {
    await saveDocumentToCloud('churnCards', card);
}

/**
 * Delete records from Firestore
 */
export async function deleteLotFromCloud(lotId) {
    await deleteDocumentFromCloud('lots', lotId);
}

export async function deleteChurningOrderFromCloud(orderId) {
    await deleteDocumentFromCloud('churningOrders', orderId);
}

export async function deleteChurnCardFromCloud(cardId) {
    await deleteDocumentFromCloud('churnCards', cardId);
}

/**
 * Batch upload local data to cloud (Initial sync)
 */
export async function uploadLocalData(lots) {
    await uploadCollectionData('lots', lots);
}

export async function uploadLocalChurningOrders(orders) {
    await uploadCollectionData('churningOrders', orders);
}

export async function uploadLocalChurnCards(cards) {
    await uploadCollectionData('churnCards', cards);
}
