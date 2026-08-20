import { FolderIcon } from '@sanity/icons/Folder'
import { ImagesIcon } from '@sanity/icons/Images'
import { UploadIcon } from '@sanity/icons/Upload'

import { WebsiteImageBulkReplace } from './components/website-image-bulk-replace'
import { WEBSITE_IMAGE_CATEGORIES } from './website-image-categories'

import type { StructureResolver } from 'sanity/structure'

export const structure: StructureResolver = (S) =>
    S.list()
        .title('Content')
        .items([
            S.listItem()
                .title('Website images')
                .icon(ImagesIcon)
                .child(
                    S.list()
                        .title('Website images')
                        .items([
                            S.listItem()
                                .title('Bulk replace images')
                                .icon(UploadIcon)
                                .child(
                                    S.component()
                                        .id('bulk-replace-website-images')
                                        .title('Bulk replace Website images')
                                        .component(WebsiteImageBulkReplace)
                                ),
                            S.divider(),
                            ...WEBSITE_IMAGE_CATEGORIES.map((category) =>
                                S.listItem()
                                    .title(category)
                                    .icon(FolderIcon)
                                    .child(
                                        S.documentList()
                                            .id(`website-images-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
                                            .title(category)
                                            .schemaType('websiteImage')
                                            .filter(
                                                '_type == "websiteImage" && !(_id in path("drafts.**")) && category == $category'
                                            )
                                            .params({ category })
                                    )
                            ),
                        ])
                ),
            S.divider(),
            S.listItem()
                .title('Birthday Parties')
                .icon(FolderIcon)
                .child(
                    S.list()
                        .title('Birthday Parties')
                        .items([
                            S.documentTypeListItem('birthdayPartyCreation'),
                            S.documentTypeListItem('birthdayPartyPackage'),
                        ])
                ),
            S.listItem()
                .title('Holiday Programs')
                .icon(FolderIcon)
                .child(
                    S.list()
                        .title('Holiday Programs')
                        .items([
                            S.documentTypeListItem('holidayProgramCreation'),
                            S.documentTypeListItem('holidayProgramWeek'),
                        ])
                ),
        ])
