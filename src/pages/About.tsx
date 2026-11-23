import { Show, createMemo } from "solid-js";
import { useAtlas } from "../state/atlas.tsx";

export function About() {
  const { atlas, state, actions } = useAtlas();
  const stats = createMemo(() => {
    const nodes = [...atlas.nodes.values()];
    const claims = nodes.flatMap(n => [...n.claims.values()]);
    return {
      languages: nodes.filter(n => n.l.kind !== "group").length,
      families: atlas.roots.length,
      works: nodes.reduce((s, n) => s + n.l.works.length, 0),
      sources: new Set(nodes.flatMap(n => [...n.sources.values()].map(s => s.url))).size,
      claims: claims.length + atlas.journeyClaims.size + atlas.storyClaims.size,
      verified:
        claims.filter(c => c.status === "verified").length +
        [...atlas.journeyClaims.values(), ...atlas.storyClaims.values()].filter(c => c.status === "verified").length
    };
  });

  return (
    <Show when={state.aboutOpen}>
      <div class="overlay" onClick={() => actions.openAbout(false)}>
        <article class="about glass" role="dialog" aria-label="About and method" onClick={e => e.stopPropagation()}>
          <button class="panel-close" aria-label="Close" onClick={() => actions.openAbout(false)}>
            ×
          </button>
          <h2>About &amp; method</h2>
          <p class="lede">
            The World Language Tree follows the world's languages from the first written records to today: where they came from, how they spread
            and split, and some of the great works written in them.
          </p>
          <div class="stats">
            <div>
              <b>{stats().languages}</b>
              <span>languages &amp; ancestors</span>
            </div>
            <div>
              <b>{stats().families}</b>
              <span>families &amp; isolates</span>
            </div>
            <div>
              <b>{stats().works}</b>
              <span>great works</span>
            </div>
            <div>
              <b>
                {stats().verified}/{stats().claims}
              </b>
              <span>claims verified</span>
            </div>
          </div>

          <h3>How facts are checked</h3>
          <ol>
            <li>
              <b>Every fact is sourced.</b> Each date, place, classification, paragraph and excerpt in the data cites the sources it comes from:
              Glottolog, encyclopedias, museums, university pages and text editions such as Wikisource and Perseus.
            </li>
            <li>
              <b>An independent fact-checker re-checks every claim.</b> A separate verifier that did not write the data opens each cited source,
              confirms names, dates and numbers against an independent source, and then verifies, corrects or removes the claim. Verified claims
              carry a <span class="claim-mark verified">✓</span>.
            </li>
            <li>
              <b>Edits invalidate verification.</b> Each claim is fingerprinted. If it changes, its verification lapses and the build refuses to
              publish it until it is re-checked.
            </li>
          </ol>

          <h3>How to read the atlas</h3>
          <ul>
            <li>
              <b>Glowing points</b> show where a language is attested at the selected time: its homeland, inscriptions and texts, and (for living
              languages) Glottolog's present-day centre. When a language dies out, its points fade to embers. The atlas draws{" "}
              <em>points of evidence</em>, not invented borders.
            </li>
            <li>
              <b>Threads</b> link a language to its ancestor's homeland and to the places it spread to.
            </li>
            <li>
              <b>Reconstructed</b> languages (Proto-Indo-European, for example) have no texts. Comparative linguistics infers them, so their dates
              and homelands are approximate, and competing hypotheses are listed under "Scholarly debate".
            </li>
            <li>
              <b>Families are not joined to one another.</b> No common ancestor of all languages has been demonstrated, so each family grows from its
              own root.
            </li>
          </ul>

          <h3>Credits</h3>
          <p class="credits">
            Classification and coordinates:{" "}
            <a href="https://glottolog.org" target="_blank" rel="noreferrer">
              Glottolog
            </a>{" "}
            (Hammarström, Forkel, Haspelmath &amp; Bank; CC-BY 4.0). Basemap:{" "}
            <a href="https://www.naturalearthdata.com" target="_blank" rel="noreferrer">
              Natural Earth
            </a>{" "}
            (public domain). Type: Noto and Cormorant Garamond (SIL Open Font License). Literary excerpts are public-domain texts; translations are
            public domain or literal renderings made for this project. Built with{" "}
            <a href="https://www.solidjs.com" target="_blank" rel="noreferrer">
              Solid 2
            </a>{" "}
            and{" "}
            <a href="https://maplibre.org" target="_blank" rel="noreferrer">
              MapLibre
            </a>
            . {stats().sources} distinct sources cited.
          </p>
        </article>
      </div>
    </Show>
  );
}
