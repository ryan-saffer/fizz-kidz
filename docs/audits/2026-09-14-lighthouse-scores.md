# Lighthouse score matrix

Measured on 14 September 2026. See the [audit report](2026-09-14-lighthouse.md) for methodology, limitations, fixes and remaining work. Each cell is before → after, using local production builds and applied DevTools throttling. The live site has not been updated.

Careers includes a local-only upload API 404. Two Google tag downloads failed during the K-Pop Power mobile after-run, lowering Best practices and reducing its measured JavaScript work. Its performance result is affected by that failure. Malvern's mobile slowdown also appeared in a focused repeat and remains unresolved. See the report for details.

## Mobile

| Route                                          | Performance | Accessibility | Best practices | SEO       |
| ---------------------------------------------- | ----------- | ------------- | -------------- | --------- |
| /                                              | 72 → 81     | 88 → 96       | 73 → 77        | 100 → 100 |
| /activations-and-events/                       | 97 → 98     | 88 → 96       | 73 → 77        | 100 → 100 |
| /after-school-programs/art-and-makers-program/ | 97 → 97     | 89 → 96       | 73 → 77        | 100 → 100 |
| /after-school-programs/science-program/        | 97 → 97     | 89 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/                             | 98 → 96     | 89 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/at-home-parties/             | 98 → 98     | 89 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/book-a-party/                | 97 → 98     | 93 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/creations/                   | 98 → 98     | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/fairy-parties/               | 96 → 98     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/fluid-bears-parties/         | 97 → 97     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/glam-parties/                | 97 → 97     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/jungle-safari-parties/       | 97 → 97     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/k-pop-power-parties/         | 97 → 99     | 87 → 96       | 73 → 73        | 100 → 100 |
| /birthday-parties/kawaii-kitty-parties/        | 97 → 98     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/science-parties/             | 96 → 97     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/slime-parties/               | 96 → 98     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/taylor-swift-parties/        | 98 → 98     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/tie-dye-parties/             | 97 → 97     | 87 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/unicorn-parties/             | 97 → 97     | 87 → 96       | 73 → 77        | 100 → 100 |
| /careers/                                      | 98 → 98     | 93 → 96       | 69 → 73        | 100 → 100 |
| /contact-us/                                   | 97 → 98     | 93 → 96       | 73 → 77        | 100 → 100 |
| /franchising/                                  | 96 → 97     | 91 → 96       | 69 → 77        | 100 → 100 |
| /gift-cards/                                   | 97 → 97     | 93 → 96       | 73 → 77        | 100 → 100 |
| /holiday-programs/                             | 97 → 97     | 89 → 96       | 73 → 77        | 100 → 100 |
| /in-schools/after-school-programs/             | 92 → 94     | 87 → 96       | 73 → 77        | 100 → 100 |
| /in-schools/incursions/                        | 97 → 97     | 88 → 96       | 73 → 77        | 100 → 100 |
| /locations/                                    | 98 → 97     | 90 → 96       | 73 → 77        | 100 → 100 |
| /locations/balwyn/                             | 98 → 98     | 85 → 96       | 73 → 77        | 100 → 100 |
| /locations/cheltenham/                         | 98 → 98     | 85 → 96       | 73 → 77        | 100 → 100 |
| /locations/essendon/                           | 98 → 98     | 85 → 96       | 73 → 77        | 100 → 100 |
| /locations/geelong/                            | 98 → 96     | 85 → 96       | 73 → 77        | 100 → 100 |
| /locations/kingsville/                         | 98 → 98     | 85 → 96       | 73 → 77        | 100 → 100 |
| /locations/malvern/                            | 98 → 93     | 85 → 96       | 73 → 77        | 100 → 100 |
| /locations/werribee/                           | 98 → 98     | 89 → 96       | 73 → 77        | 100 → 100 |
| /our-team/                                     | 97 → 97     | 89 → 96       | 73 → 77        | 100 → 100 |
| /policies/                                     | 98 → 98     | 91 → 96       | 73 → 77        | 100 → 100 |
| /preschool-program/                            | 97 → 98     | 89 → 96       | 73 → 77        | 100 → 100 |

## Desktop

| Route                                          | Performance | Accessibility | Best practices | SEO       |
| ---------------------------------------------- | ----------- | ------------- | -------------- | --------- |
| /                                              | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /activations-and-events/                       | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /after-school-programs/art-and-makers-program/ | 100 → 100   | 94 → 96       | 73 → 77        | 100 → 100 |
| /after-school-programs/science-program/        | 100 → 100   | 94 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/                             | 100 → 100   | 94 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/at-home-parties/             | 100 → 100   | 94 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/book-a-party/                | 100 → 100   | 96 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/creations/                   | 100 → 100   | 96 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/fairy-parties/               | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/fluid-bears-parties/         | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/glam-parties/                | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/jungle-safari-parties/       | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/k-pop-power-parties/         | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/kawaii-kitty-parties/        | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/science-parties/             | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/slime-parties/               | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/taylor-swift-parties/        | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/tie-dye-parties/             | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /birthday-parties/unicorn-parties/             | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /careers/                                      | 100 → 100   | 96 → 96       | 69 → 73        | 100 → 100 |
| /contact-us/                                   | 100 → 100   | 96 → 96       | 73 → 77        | 100 → 100 |
| /franchising/                                  | 100 → 100   | 95 → 96       | 69 → 77        | 100 → 100 |
| /gift-cards/                                   | 100 → 100   | 96 → 96       | 73 → 77        | 100 → 100 |
| /holiday-programs/                             | 100 → 100   | 94 → 96       | 73 → 77        | 100 → 100 |
| /in-schools/after-school-programs/             | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /in-schools/incursions/                        | 100 → 100   | 91 → 96       | 73 → 77        | 100 → 100 |
| /locations/                                    | 100 → 100   | 94 → 96       | 73 → 77        | 100 → 100 |
| /locations/balwyn/                             | 100 → 100   | 89 → 96       | 73 → 77        | 100 → 100 |
| /locations/cheltenham/                         | 100 → 100   | 89 → 96       | 73 → 77        | 100 → 100 |
| /locations/essendon/                           | 100 → 100   | 89 → 96       | 73 → 77        | 100 → 100 |
| /locations/geelong/                            | 100 → 100   | 89 → 96       | 73 → 77        | 100 → 100 |
| /locations/kingsville/                         | 100 → 100   | 89 → 96       | 73 → 77        | 100 → 100 |
| /locations/malvern/                            | 100 → 100   | 89 → 96       | 73 → 77        | 100 → 100 |
| /locations/werribee/                           | 100 → 100   | 93 → 96       | 73 → 77        | 100 → 100 |
| /our-team/                                     | 100 → 100   | 94 → 96       | 73 → 77        | 100 → 100 |
| /policies/                                     | 100 → 100   | 96 → 96       | 73 → 77        | 100 → 100 |
| /preschool-program/                            | 100 → 100   | 93 → 96       | 73 → 77        | 100 → 100 |

## Live production sample

These are the deployed site scores before these changes, using the default simulated throttling. They are not the modified build and should not be compared directly with the applied-throttling tables above.

| Route                            | Device  | Performance | Accessibility | Best practices | SEO |
| -------------------------------- | ------- | ----------- | ------------- | -------------- | --- |
| /birthday-parties/slime-parties/ | desktop | 94          | 91            | 77             | 100 |
| /birthday-parties/slime-parties/ | mobile  | 98          | 87            | 77             | 100 |
| /careers/                        | desktop | 94          | 96            | 77             | 100 |
| /careers/                        | mobile  | 99          | 93            | 77             | 100 |
| /                                | desktop | 93          | 91            | 77             | 100 |
| /                                | mobile  | 69          | 88            | 77             | 100 |
| /locations/balwyn/               | desktop | 84          | 89            | 77             | 100 |
| /locations/balwyn/               | mobile  | 98          | 85            | 77             | 100 |
