// Energy Intelligence · Reference Library (global edition): market data, outlooks and auction results,
// each entry written from the original publication. Data: assets/library/energy_library_intl_v1.json.
import 'package:flutter/material.dart';

import 'library_strings_en.dart';
import 'library_binding.dart';
import 'reference_library_page.dart';

const String kEnergyLibraryAsset = 'assets/library/energy_library_intl_v1.json';

final LibraryStrings kEnergyLibraryStrings = libraryStringsEn(
  title: 'Reference Library',
  intro: 'Market data, outlooks and auction results from EIA, IEA, Ember and UK DESNZ. Every entry names its source, date and licence.',
  footer: 'Summaries of public sources, not legal or investment advice. Figures can be revised; check the original. Entries that are not yet reviewed are hidden and are never used by the AI assistant.',
);

class EnergyLibraryPage extends StatelessWidget {
  const EnergyLibraryPage({super.key});

  @override
  Widget build(BuildContext context) => ReferenceLibraryPage(
        strings: kEnergyLibraryStrings,
        assetPath: kEnergyLibraryAsset,
        live: energyLibraryLiveApi(),
      );
}

/// Entry shown in Settings; hidden until at least one reviewed entry exists.
class EnergyLibraryEntry extends StatelessWidget {
  const EnergyLibraryEntry({super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: ReferenceLibraryEntryTile(
          strings: kEnergyLibraryStrings,
          assetPath: kEnergyLibraryAsset,
          title: 'Reference Library',
          subtitle: 'Written from original sources, with dates and licences',
          onTap: () => Navigator.of(context).pushNamed('/library'),
        ),
      );
}
