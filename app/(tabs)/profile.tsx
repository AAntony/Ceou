import { CeouAvatar } from '../../src/components/CeouAvatar';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { ErrorState } from '../../src/components/ErrorState';
import { HeaderSaveButton } from '../../src/components/HeaderSaveButton';
import { Icon } from '../../src/components/Icon';
import { QrCode } from '../../src/components/QrCode';
import { TextField } from '../../src/components/TextField';
import { TextLink } from '../../src/components/TextLink';
import { usePullToRefresh } from '../../src/components/usePullToRefresh';
import { GuestProfile } from '../../src/features/auth/GuestProfile';
import { ProfileSection } from '../../src/features/profile/ProfileSection';
import { DisplaySettings } from '../../src/features/profile/DisplaySettings';
import { useIsAnonymous, useSession } from '../../src/features/auth/SessionProvider';
import { cancelAllInviteReminders } from '../../src/features/notifications/inviteReminders';
import { cancelAllLoanReminders } from '../../src/features/notifications/loanReminders';
import { cancelAllWarrantyReminders } from '../../src/features/notifications/warrantyReminders';
import { OnboardingGuide } from '../../src/features/onboarding/OnboardingGuide';
import { unregisterPushToken } from '../../src/features/notifications/push';
import { pickAndUploadAvatar } from '../../src/features/profile/uploadAvatar';
import { useProfile, useUpdateProfile } from '../../src/features/profile/useProfile';
import { formatFriendCodeQrValue } from '../../src/features/sharing/queries';
import { ShareInviteModal } from '../../src/features/sharing/ShareInviteModal';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/lib/i18n';
import { useMediaSource } from '../../src/lib/images/media';
import { useScaled } from '../../src/lib/textScale';
import { supabase } from '../../src/lib/supabase/client';
import { useThemeColors } from '../../src/lib/theme';

export default function ProfileScreen() {
  const refreshControl = usePullToRefresh();
  const colors = useThemeColors();
  // La pastille d'avatar est dessinee en pixels (image ronde recadree), donc
  // hors de portee de `rem` : elle est mise a l'echelle a la main pour ne pas
  // rester une vignette au milieu d'un ecran agrandi.
  const avatarSize = useScaled(64);
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const isGuest = useIsAnonymous();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const updateProfile = useUpdateProfile();
  const avatar = useMediaSource(profile?.avatar_url);

  const [displayName, setDisplayName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [myCodeOpen, setMyCodeOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name ?? '');
  }, [profile]);

  // CE QUI REND LA DISQUETTE DE L'EN-TETE ACTIVE. Le nom affiche est le seul
  // champ de cet ecran qu'on ENREGISTRE : l'avatar, la langue et les reglages
  // d'affichage partent en base des qu'on y touche, il n'y a rien a confirmer
  // apres coup. La disquette ne parle donc que du nom.
  const dirty = displayName !== (profile?.display_name ?? '');

  // `mutateAsync` est une reference stable (React Query v5) : la sortir de
  // l'objet de mutation est ce qui permet a handleSave de ne pas changer a
  // chaque rendu, et donc a l'effet ci-dessous de ne pas reposer le bouton
  // d'en-tete en boucle.
  const { mutateAsync: saveProfile } = updateProfile;
  const handleSave = useCallback(async () => {
    await saveProfile({ display_name: displayName });
    setSaved(true);
  }, [saveProfile, displayName]);

  const navigation = useNavigation();
  // Le bouton est posé sur l'en-tête déclaré par (tabs)/_layout.tsx. Il ne
  // peut pas l'être depuis le layout, qui n'a pas accès à l'état de saisie ;
  // useLayoutEffect plutôt que useEffect pour qu'il soit peint dans la même
  // frame que l'écran, sans apparition différée. Même montage que le bouton
  // "Ajouter" de l'onglet Amis.
  //
  // Rien pour un VISITEUR : il n'a pas de fiche à enregistrer (voir plus bas,
  // GuestProfile prend toute la place de cet écran). L'effet doit quand même
  // s'exécuter — il est au-dessus du retour anticipé, comme tous les hooks.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: isGuest
        ? undefined
        : () => (
            <HeaderSaveButton
              onPress={handleSave}
              dirty={dirty}
              // `isPending` est partagé avec les autres écritures du profil
              // (avatar, langue) : le croiser avec `dirty` évite que la
              // disquette se mette à tourner quand on change de langue, ce
              // qui n'a rien à voir avec elle.
              loading={updateProfile.isPending && dirty}
              label={t('a11y.save_changes')}
            />
          ),
    });
  }, [navigation, isGuest, handleSave, dirty, updateProfile.isPending, t]);

  const handleLanguageChange = async (language: SupportedLanguage) => {
    await i18n.changeLanguage(language);
    updateProfile.mutate({ locale: language });
  };

  // Le code ami se dicte aussi bien qu'il se scanne : quelqu'un qui n'est pas
  // dans la pièce a besoin de le recevoir par message. C'est ce que promettait
  // « Partager mon code », qui envoyait en réalité un tout autre code.
  const handleShareFriendCode = async () => {
    if (!profile?.friend_code) return;
    try {
      await Share.share({ message: t('friends.my_code.share_message', { code: profile.friend_code }) });
    } catch {
      // Feuille de partage simplement refermée — rien à faire.
    }
  };

  const handleAvatarPress = async () => {
    if (!session) return;
    setAvatarUploading(true);
    try {
      const avatarUrl = await pickAndUploadAvatar(session.user.id);
      if (avatarUrl) updateProfile.mutate({ avatar_url: avatarUrl });
    } finally {
      setAvatarUploading(false);
    }
  };

  // Un visiteur n’a ni nom affiche, ni avatar, ni code ami : le Profil normal
  // lui presenterait une fiche vide. Il obtient a la place une presentation de
  // Ceou et une invitation a creer un compte. Place APRES tous les hooks pour
  // ne pas changer leur ordre d’appel d’un rendu a l’autre.
  if (isGuest) return <GuestProfile />;

  if (isError) {
    return (
      <View className="flex-1 bg-sand">
        <ErrorState onRetry={() => refetch()} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-sand">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-sand" contentContainerClassName="px-4 pt-4 pb-40" refreshControl={refreshControl}>
      <ProfileSection title={t('profile.sections.identity.title')} summary={t('profile.sections.identity.hint')} icon="profile" defaultOpen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('profile.avatar.change')} onPress={handleAvatarPress} className="mb-4 min-h-[48px] flex-row items-center gap-4">
        <View
          className="items-center justify-center overflow-hidden rounded-full bg-sand-dark"
          style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }}
        >
          {avatarUploading ? (
            <ActivityIndicator />
          ) : profile?.avatar_url ? (
            <Image source={avatar} style={{ width: avatarSize, height: avatarSize }} />
          ) : (
            <CeouAvatar size={avatarSize} />
          )}
        </View>
        <Text className="flex-1 text-label font-semibold text-coral-dark">{t('profile.avatar.change')}</Text>
      </Pressable>

      {/* La confirmation d'enregistrement s'efface DES LA FRAPPE SUIVANTE :
          affichée en permanence après un premier enregistrement, elle
          finissait par annoncer « Profil enregistré » au-dessus d'un nom qui
          ne l'était justement plus. */}
      <TextField
        label={t('profile.display_name')}
        value={displayName}
        onChangeText={(value) => {
          setDisplayName(value);
          setSaved(false);
        }}
      />

      {saved ? <Text className="mb-4 text-label text-green-600">{t('profile.saved')}</Text> : null}

      </ProfileSection>

      <Pressable accessibilityRole="button" onPress={() => router.push('/forfait')} className="mb-3 min-h-[72px] flex-row items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4">
        <Icon name="star" size={24} />
        <View className="flex-1"><Text className="text-body font-semibold text-ink">{t('billing.entry')}</Text><Text className="mt-1 text-caption text-ink-soft">{t('billing.entry_hint')}</Text></View>
        <Icon name="chevron" size={18}/>
      </Pressable>
      <ProfileSection title={t('profile.sections.preferences.title')} summary={t('profile.sections.preferences.hint')} icon="theme">
      <Text className="mb-2 text-label font-medium text-ink-soft">{t('profile.language')}</Text>
      <View className="flex-row gap-2">
        {SUPPORTED_LANGUAGES.map((language) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: i18n.language === language }}
            accessibilityLabel={language === 'fr' ? 'Français' : 'English'}
            key={language}
            onPress={() => handleLanguageChange(language)}
            className={`min-h-[48px] flex-1 items-center justify-center rounded-xl border px-4 py-2 ${
              i18n.language === language ? 'border-coral bg-coral' : 'border-ink/10'
            }`}
          >
            <Text className={i18n.language === language ? 'font-semibold text-white' : 'text-ink-soft'}>
              {language === 'fr' ? 'Français' : 'English'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-5">
        <DisplaySettings embedded />
      </View>

      </ProfileSection>
      <ProfileSection title={t('profile.sections.help.title')} summary={t('profile.sections.help.hint')} icon="guide">
      {/* Le guide de démarrage se rejoue à volonté. Il n'est pas rangé avec
          les liens de bas de page (Compte, Confidentialité) : ce n'est pas
          une mention légale, c'est la porte de secours de quelqu'un qui ne
          sait plus comment on range — elle doit se voir. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setGuideOpen(true)}
        className="min-h-[48px] flex-row items-center gap-3 py-3 active:opacity-70"
      >
        <Icon name="guide" size={22} color={colors.accentDark} />
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t('onboarding.replay')}</Text>
          <Text className="mt-0.5 text-caption text-ink-soft">{t('onboarding.entry_hint')}</Text>
        </View>
        <Icon name="chevron" size={20} color={colors.inkFaint} />
      </Pressable>

      {/* LES TUTORIELS JUSTE SOUS LE GUIDE, et pas ailleurs : les deux
          apprennent l'app, et c'est ici qu'on vient quand on ne sait plus
          comment on fait. Ils ne font pas double emploi — le guide se FAIT une
          fois le premier jour et n'enseigne que le rangement ; les tutoriels
          se RELISENT, et couvrent tout le reste. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/tutoriels')}
        className="min-h-[48px] flex-row items-center gap-3 border-t border-ink/10 py-3 active:opacity-70"
      >
        <Icon name="help" size={22} color={colors.accentDark} />
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t('tutoriels.entry_title')}</Text>
          <Text className="mt-0.5 text-caption text-ink-soft">{t('tutoriels.entry_hint')}</Text>
        </View>
        <Icon name="chevron" size={20} color={colors.inkFaint} />
      </Pressable>

      </ProfileSection>
      <ProfileSection title={t('profile.sections.sharing.title')} summary={t('profile.sections.sharing.hint')} icon="friends">
      {/* Le code ami et le code d'invité sont deux choses différentes, donc
          deux sections distinctes. Réunis sous un même bouton « Partager mon
          code », ils produisaient un code d'ami que personne ne pouvait
          saisir à la main — le défaut corrigé le 26/08. */}
      <Text className="mb-1 text-body font-semibold text-ink">{t('friends.my_code.title')}</Text>
      <Text className="mb-2 text-caption leading-4 text-ink-soft">{t('friends.my_code.subtitle')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: myCodeOpen }}
        accessibilityLabel={`${t('friends.my_code.title')}, ${profile?.friend_code ?? ''}`}
        onPress={() => setMyCodeOpen((current) => !current)}
        className="flex-row items-center justify-between rounded-xl border border-ink/10 bg-sand-dark px-4 py-3"
      >
        <Text className="text-body font-bold tracking-widest text-ink">{profile?.friend_code}</Text>
        <Icon name={myCodeOpen ? 'excluded' : 'qrcode'} size={20} color={colors.inkSoft} />
      </Pressable>
      {myCodeOpen && profile ? (
        <View className="mt-3 items-center">
          <QrCode value={formatFriendCodeQrValue(profile.friend_code)} size={160} />
          <Text className="mt-2 text-center text-caption text-ink-soft">{t('friends.my_code.hint')}</Text>
        </View>
      ) : null}

      <View className="mt-3">
        <Button label={t('friends.my_code.share')} variant="outline" onPress={handleShareFriendCode} />
      </View>

      <Text className="mb-1 mt-6 text-body font-semibold text-ink">{t('friends.share.section_title')}</Text>
      <Text className="mb-2 text-caption leading-4 text-ink-soft">{t('friends.share.section_hint')}</Text>
      <Button label={t('friends.share.entry')} variant="outline" onPress={() => setShareModalOpen(true)} />

      {/* Nécessaire dès lors qu'un code peut être permanent et multi-usage :
          un code éphémère à usage unique se gérait tout seul en expirant, un
          QR laissé affiché dans un logement demande de pouvoir savoir qui
          l'a utilisé et de le couper. */}
      <TextLink
        href="/invites"
        label={t('invites.entry')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-label font-semibold text-ink"
      />

      </ProfileSection>
      <ProfileSection title={t('profile.sections.account.title')} summary={t('profile.sections.account.hint')} icon="security">
      {/* LA CORBEILLE EST RANGÉE AVEC LES RÉGLAGES, pas avec l'inventaire : on
          n'y va pas pour consulter ses affaires, on y va parce qu'on vient
          d'en perdre. C'est l'endroit où l'on cherche quand quelque chose a
          disparu — donc le même endroit que le reste de ce qui répare. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/corbeille')}
        className="min-h-[48px] flex-row items-center gap-3 py-3 active:opacity-70"
      >
        <Icon name="delete" size={22} color={colors.inkSoft} />
        <View className="flex-1">
          <Text className="text-label font-semibold text-ink">{t('corbeille.entry_title')}</Text>
          <Text className="mt-0.5 text-caption text-ink-soft">{t('corbeille.entry_hint')}</Text>
        </View>
        <Icon name="chevron" size={20} color={colors.inkFaint} />
      </Pressable>

      {/* Adresse, mot de passe et suppression vivent sur un écran à part :
          cet écran-ci porte l'identité PUBLIQUE (nom affiché, avatar, code
          ami, langue), pas les clés d'accès. */}
      <TextLink
        href="/account"
        label={t('account.entry')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-label font-semibold text-ink"
      />

      {/* La carte ELLE-MÊME est le bouton : c'était un View inerte dont seul
          le texte réagissait — le défaut signalé par les testeurs. */}
      <TextLink
        href="/privacy-policy"
        label={t('profile.privacy_policy')}
        className="mt-3 items-center rounded-2xl border border-ink/10 bg-surface px-4 py-3"
        textClassName="text-label font-medium text-ink-soft underline"
      />

      <TextLink
        onPress={async () => {
          // Détache l'appareil AVANT de perdre la session : la suppression
          // du jeton passe par la RLS (`user_id = auth.uid()`), elle
          // échouerait silencieusement une fois déconnecté — et le compte
          // continuerait de recevoir les notifications de ce téléphone.
          await unregisterPushToken();
          // Les rappels sont programmés sur l'appareil : sans ce ménage,
          // celui d'un code du compte précédent surgirait chez la personne
          // suivante, en nommant une Habitation qui ne la concerne pas.
          await cancelAllInviteReminders();
          await cancelAllLoanReminders();
          await cancelAllWarrantyReminders();
          await supabase.auth.signOut();
        }}
        label={t('profile.sign_out')}
        className="mt-6"
        textClassName="text-center text-label font-semibold text-danger"
      />

      </ProfileSection>

      {/* Le numéro "1.0.0" seul ne bouge presque jamais — le hash de commit
          (injecté par app.config.js à chaque bundle/build) est ce qui
          permet réellement de savoir quelle version est en train de tourner
          sur un appareil de test. */}
      <Text className="mt-4 text-center text-caption text-ink-soft">
        {t('profile.version_label')} {Constants.expoConfig?.version ?? '?'} ({Constants.expoConfig?.extra?.gitCommit ?? '?'})
      </Text>

      <ShareInviteModal visible={shareModalOpen} onClose={() => setShareModalOpen(false)} />

      <OnboardingGuide visible={guideOpen} onClose={() => setGuideOpen(false)} />
    </ScrollView>
  );
}
