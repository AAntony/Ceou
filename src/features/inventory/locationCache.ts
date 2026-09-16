import type { QueryClient } from '@tanstack/react-query';
import type { Conteneur, Emplacement, Piece, Habitation } from '../../types/database';
import type { EntityLookups } from './locationChain';

/**
 * Les mêmes recherches, mais servies par le CACHE.
 *
 * Le préchargement a posé chaque entité sous sa propre clé (`['piece', id]`,
 * `['conteneur', id]`…) : il n'y a donc rien à redemander pour recalculer un
 * chemin après un déplacement fait hors-ligne. Les recherches sont directes,
 * jamais une énumération du cache.
 */
export function lookupsFromCache(client: QueryClient): EntityLookups {
  return {
    conteneur: (id) => client.getQueryData<Conteneur>(['conteneur', id]),
    emplacement: (id) => client.getQueryData<Emplacement>(['emplacement', id]),
    piece: (id) => client.getQueryData<Piece>(['piece', id]),
    habitation: (id) => client.getQueryData<Habitation>(['habitation', id]),
  };
}
