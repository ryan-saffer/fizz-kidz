import { ArchiveIcon } from '@sanity/icons/Archive'
import { DocumentTextIcon } from '@sanity/icons/DocumentText'
import { FolderIcon } from '@sanity/icons/Folder'
import { ImagesIcon } from '@sanity/icons/Images'
import { SearchIcon } from '@sanity/icons/Search'
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
                            S.listItem()
                                .title('Search instructions')
                                .icon(SearchIcon)
                                .child(
                                    S.documentList()
                                        .id('holiday-program-search-instructions')
                                        .title('Search Holiday Program instructions')
                                        .schemaType('holidayProgramCreation')
                                        .filter('_type == "holidayProgramCreation"')
                                        .defaultOrdering([{ field: 'date', direction: 'desc' }])
                                        .initialValueTemplates([])
                                ),
                            S.divider(),
                            S.listItem()
                                .title('Live instructions')
                                .icon(DocumentTextIcon)
                                .child(
                                    S.documentList()
                                        .id('holiday-program-live-instructions')
                                        .title('Live instructions')
                                        .schemaType('holidayProgramCreation')
                                        .filter(
                                            '_type == "holidayProgramCreation" && (status == "live" || !defined(status))'
                                        )
                                        .defaultOrdering([{ field: 'date', direction: 'asc' }])
                                ),
                            S.listItem()
                                .title('Archive')
                                .icon(ArchiveIcon)
                                .child(
                                    S.documentList()
                                        .id('holiday-program-archived-instructions')
                                        .title('Archived instructions')
                                        .schemaType('holidayProgramCreation')
                                        .filter('_type == "holidayProgramCreation" && status == "archived"')
                                        .defaultOrdering([{ field: 'date', direction: 'desc' }])
                                        .initialValueTemplates([])
                                ),
                            S.documentTypeListItem('holidayProgramWeek'),
                        ])
                ),
        ])
