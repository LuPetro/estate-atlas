# EstateAtlas web design

The sign-in architecture sets the visual direction for the web platform: warm paper,
terracotta actions, olive secondary tones and a restrained serif treatment for page titles.

`apps/web/app/platform.css` is the shared visual system, imported after the structural and
feature styles in `globals.css`. Its root variables are the source for colors, surfaces,
chart colors and sidebar width. The legacy `--green` variables alias the action color;
new styles should use `--accent`. Gains and losses have separate `--positive` and
`--negative` colors.

`Brand.tsx` supplies the wordmark for portfolio, account, administration and service pages.
`PropertyArtwork.tsx` renders abstract architecture by property type; it does not depict
the actual property. The sign-in illustration keeps its own component styles.

Keep interaction targets usable on small screens, form text at least 16px on mobile,
keyboard focus visible, and tables scrollable inside their containers. Motion is limited
to entrances and interaction feedback; reduced-motion preference disables it throughout.
The native Expo app remains a separate application; this stylesheet covers responsive web
and its PWA presentation.

Design changes reach Dev through successful push CI and the development deployment.
After review and a release pull request from Dev to Main, successful Main checks
automatically promote that tested version to production.
