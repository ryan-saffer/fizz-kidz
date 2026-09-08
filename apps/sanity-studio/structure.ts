import { ArchiveIcon } from '@sanity/icons/Archive'
import { BlockContentIcon } from '@sanity/icons/BlockContent'
import { CalendarIcon } from '@sanity/icons/Calendar'
import { ComponentIcon } from '@sanity/icons/Component'
import { ConfettiIcon } from '@sanity/icons/Confetti'
import { FolderIcon } from '@sanity/icons/Folder'
import { ImagesIcon } from '@sanity/icons/Images'
import { SearchIcon } from '@sanity/icons/Search'
import { SortIcon } from '@sanity/icons/Sort'
import { SparklesIcon } from '@sanity/icons/Sparkles'
import { UploadIcon } from '@sanity/icons/Upload'

import { BirthdayPartyPackageManager } from './components/birthday-party-package-manager'
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
                .icon(ConfettiIcon)
                .child(
                    S.list()
                        .title('Birthday Parties')
                        .items([
                            S.listItem()
                                .title('Packages')
                                .icon(ComponentIcon)
                                .child(
                                    S.list()
                                        .title('Packages')
                                        .items([
                                            S.listItem()
                                                .title('Reorder and publish packages')
                                                .icon(SortIcon)
                                                .child(
                                                    S.component()
                                                        .id('birthday-party-package-manager')
                                                        .title('Reorder and publish packages')
                                                        .component(BirthdayPartyPackageManager)
                                                ),
                                            S.divider(),
                                            S.documentTypeListItem('birthdayPartyPackage')
                                                .title('All packages')
                                                .icon(ComponentIcon),
                                        ])
                                ),
                            S.listItem()
                                .title('Creations')
                                .icon(SparklesIcon)
                                .child(
                                    S.list()
                                        .title('Creations')
                                        .items([
                                            S.listItem()
                                                .title('Live')
                                                .icon(SparklesIcon)
                                                .child(
                                                    S.documentList()
                                                        .id('birthday-party-live-creations')
                                                        .title('Live creations')
                                                        .schemaType('birthdayPartyCreationOffering')
                                                        .filter(
                                                            '_type == "birthdayPartyCreationOffering" && status == "active"'
                                                        )
                                                        .defaultOrdering([{ field: 'name', direction: 'asc' }])
                                                        .initialValueTemplates([
                                                            S.initialValueTemplateItem('birthdayPartyCreationOffering'),
                                                        ])
                                                ),
                                            S.listItem()
                                                .title('Archived')
                                                .icon(ArchiveIcon)
                                                .child(
                                                    S.documentList()
                                                        .id('birthday-party-archived-creations')
                                                        .title('Archived creations')
                                                        .schemaType('birthdayPartyCreationOffering')
                                                        .filter(
                                                            '_type == "birthdayPartyCreationOffering" && status == "retired"'
                                                        )
                                                        .defaultOrdering([{ field: 'name', direction: 'asc' }])
                                                        .initialValueTemplates([])
                                                ),
                                        ])
                                ),
                            S.documentTypeListItem('birthdayPartyCreation')
                                .title('Creation instructions')
                                .icon(BlockContentIcon),
                        ])
                ),
            S.listItem()
                .title('Holiday Programs')
                .icon(CalendarIcon)
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
                                .icon(BlockContentIcon)
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
