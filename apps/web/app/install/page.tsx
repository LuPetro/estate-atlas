import InfoPage from '../../src/InfoPage';
import InstallApp from '../../src/InstallApp';
export default function Page() {
  return (
    <InfoPage title="EstateAtlas auf deinem Gerät">
      <p>Dein Workspace mit einem eigenen Symbol auf dem Startbildschirm – ohne App Store.</p>
      <InstallApp />
    </InfoPage>
  );
}
