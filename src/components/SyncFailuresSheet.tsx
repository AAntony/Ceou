import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { dismissSyncFailure, type SyncFailure } from "../lib/syncFailures";
import { useWrite } from "../lib/writeQueue";
import { Button } from "./Button";
import { ButtonRow } from "./ButtonRow";

// LA LISTE DE CE QUI N'EST PAS PASSE, ET LE CHOIX QU'ON LAISSE.
//
// Deux boutons seulement, parce qu'il n'y a que deux issues honnetes :
// retenter, ou renoncer en le sachant. Pas de « corriger » — l'application
// ne sait pas pourquoi le serveur a refuse, et proposer de reparer sans
// savoir quoi serait une promesse en l'air.
//
// LE MESSAGE DU SERVEUR EST MONTRE, en petit, sous la phrase. Il est en
// anglais et technique, donc il n'explique rien a la plupart des gens — mais
// c'est la seule chose qui permette de dire pourquoi, quand on le demande.
// Le cacher rendrait tout diagnostic impossible a distance.
export function SyncFailuresSheetContent({
  failures,
}: {
  failures: SyncFailure[];
}) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const write = useWrite();

  // RETIREE DE LA LISTE AVANT MEME D'ETRE RENVOYEE, et c'est voulu : si le
  // serveur refuse a nouveau, `MutationCache.onError` reinscrit l'echec avec
  // son message a jour. Le garder en place en attendant afficherait deux fois
  // la meme modification le temps de l'aller-retour.
  const retry = (failure: SyncFailure) => {
    dismissSyncFailure(client, failure.id);
    write.mutate({ ops: failure.ops, describe: failure.describe });
  };

  return (
    <View>
      <Text className="mb-1 text-heading font-bold text-ink">
        {t("sync.title")}
      </Text>
      <Text className="mb-4 text-body text-ink-soft">{t("sync.intro")}</Text>

      <View className="gap-3">
        {failures.map((failure) => (
          <View key={failure.id} className="gap-2 rounded-2xl bg-sand p-4">
            <Text className="text-body font-semibold text-ink">
              {t(`sync.failed.${failure.describe.kind}`, {
                name: failure.describe.name || t("sync.unnamed"),
              })}
            </Text>
            {failure.message ? (
              <Text numberOfLines={3} className="text-caption text-ink-soft">
                {failure.message}
              </Text>
            ) : null}
            <ButtonRow>
              <Button
                label={t("sync.retry")}
                variant="outline"
                onPress={() => retry(failure)}
              />
              <Button
                label={t("sync.dismiss")}
                variant="ghost"
                onPress={() => dismissSyncFailure(client, failure.id)}
              />
            </ButtonRow>
          </View>
        ))}
      </View>
    </View>
  );
}
