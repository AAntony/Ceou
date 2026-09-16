export function needsProfileSetup({ signedIn, anonymous, profileLoaded, name, pathname }: {
  signedIn: boolean; anonymous: boolean; profileLoaded: boolean; name?: string | null; pathname: string;
}) {
  return signedIn && !anonymous && profileLoaded && !name?.trim() && pathname !== '/reset-password';
}
