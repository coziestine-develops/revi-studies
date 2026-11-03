import { supabase } from '../lib/supabase';
import type { Collection, CollectionItem } from '../types/database';

export async function listCollections(): Promise<Collection[]> {
  const { data, error } = await supabase.from('collections').select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Collection[];
}

export async function listCollectionItems(): Promise<CollectionItem[]> {
  const { data, error } = await supabase.from('collection_items').select('collection_id, reviewer_id');
  if (error) throw error;
  return (data ?? []) as CollectionItem[];
}

export async function createCollection(ownerId: string, name: string): Promise<void> {
  const { error } = await supabase.from('collections').insert({ owner_id: ownerId, name });
  if (error) throw error;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('collections').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
}

export async function addToCollection(collectionId: string, reviewerId: string): Promise<void> {
  const { error } = await supabase.from('collection_items').insert({ collection_id: collectionId, reviewer_id: reviewerId });
  if (error) throw error;
}

export async function removeFromCollection(collectionId: string, reviewerId: string): Promise<void> {
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('reviewer_id', reviewerId);
  if (error) throw error;
}
