# Third-party notices

The project's license does not replace the licenses of dependencies, bundled fonts or map data. Preserve their notices when redistributing them.

## Bundled assets

| Asset                          | Terms and source                                                                                        | Included notice                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| DM Sans                        | SIL Open Font License 1.1; [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/dmsans)  | [DM-Sans-OFL.txt](apps/web/public/fonts/DM-Sans-OFL.txt)                            |
| Manrope                        | SIL Open Font License 1.1; [Google Fonts source](https://github.com/google/fonts/tree/main/ofl/manrope) | [Manrope-OFL.txt](apps/web/public/fonts/Manrope-OFL.txt)                            |
| Natural Earth country geometry | Public domain; [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/)              | [Source, version and transformation](packages/shared/src/world-countries-source.md) |

Fonts are served locally. The overview map uses the bundled, generalized country geometry. The house illustration on the sign-in page is rendered by the application's SVG components. Documentation screenshots show the app with synthetic fixtures, not photographs of real portfolios.

## External services and dependencies

OpenStreetMap detail tiles, the optional CARTO basemap and the configured Photon geocoder are external services with their own terms, attribution requirements and availability limits. Their data is not relicensed by this repository. UI attribution remains required. See [self-hosting](docs/docker.md) and the map/provider implementation before changing a provider.

JavaScript packages and base container images retain their own licenses. Their versions are recorded in `pnpm-lock.yaml`, workspace manifests, `Dockerfile` and Compose files; installed dependencies include their upstream notices. This file records bundled asset provenance and is not an exhaustive dependency license audit.
