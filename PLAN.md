# Website refresh — 2026-11-13

## Approved scope and decisions
- Fix the profile photo that fails in Chrome.
- Verify the four existing research entries and update publication statuses and links.
- Improve the research section with visually engaging, responsive figures.
- User authorized parallel agents for publication verification, figure inspection, and implementation.
- Initial conceptual artwork was superseded by the user's request for actual paper figures. Generated library originals remain retained; generated artwork is not part of the website.
- Use original published/preprint figure geometry with explicit, user-controlled interactions. Do not generate experimental data, interpolate between published settings, or claim a fresh simulation.
- Broader homepage redesign and additional papers are outside this pass.

## Verified publication sources
- SPD regularization: IMA Journal of Numerical Analysis, online 31 May 2026. https://doi.org/10.1093/imanum/drag010
- DGCP: Mathematical Programming Computation, published 11 July 2026. https://doi.org/10.1007/s12532-026-00325-2
- High-dimensional minibatch algorithms: OPT 2024 / NeurIPS Optimization for Machine Learning Workshop. https://opt-ml.org/papers/2024/paper25.pdf
- Mini-batch momentum: NeurIPS 2022 main conference. https://proceedings.neurips.cc/paper_files/paper/2022/hash/efcb76ac1df9231a24893a957fcb9001-Abstract-Conference.html
- Separate related Allerton paper: https://doi.org/10.1109/Allerton63246.2024.10735290
- User-supplied Scholar profile: https://scholar.google.com/citations?user=csPvpukAAAAJ&hl=en . Automated fetching returned 429; journal labels were verified with primary publishers and official proceedings.

## Figure provenance and interpretation
Original SVGs and source hashes/crop coordinates are recorded in images/research/provenance.json.

1. DGCP, Figure 2, arXiv v2 page 22: https://arxiv.org/pdf/2407.05261v2#page=22
   - Exact expression-tree crop; user-controlled bottom-up curvature-verification walkthrough.
   - Preserve the original arrows and labels. Explain curvature propagation, not optimizer execution. Avoid restating the source's Positive label for logdet as a universal assertion.
2. SPD regularization, Figure 7, arXiv v1 page 40: https://arxiv.org/pdf/2410.09660v1#page=40
   - Exported from original standalone vector PDFs under Research/spd_arxiv/figuresV2/Gaussian_MLE/.
   - Dataset selectors: n=100,d=30 and n=1500,d=100; focus beta=0,1,2,10.
   - x is time; y is log-scaled distance to true covariance. Higher beta moves toward the supplied estimate, not necessarily toward truth. Retain different time horizons and both reference curves.
3. High-dimensional minibatch algorithms, Figure 1, PDF page 5.
   - Switch between SGD+momentum and strongly-convex Nesterov panels; focus original sample-size bands.
   - Preserve 90th-percentile bands, log y-scale, and red Volterra prediction. Source parameters: momentum 0.8, learning rate 0.5, batch fraction 0.5.
4. Mini-batch momentum, Figure 4, PDF page 7.
   - Select or cycle the four original SGD+M batch-fraction panels: 0.85,0.70,0.50,0.25.
   - Preserve the original vertical axes and colorbar ranges, which vary. x is momentum and y is learning rate. Hollow orange circles are Polyak parameters; filled circles are average-case optima. Do not interpolate.

## Implementation and verification
- Profile source cafe.png was byte-identical to cafe.heic. Exported genuine JPEG at 1200×1600, changed its URL, and preserved original HEIC.
- Photo fix committed/pushed as 19a34ff; GitHub Pages reported the same commit built successfully.
- Original photo failure reproduced in Chrome; format-signature regression check fails before and passes after. Corrected photo visually inspected and served locally with HTTP 200 image/jpeg.
- A sandboxed HEIC conversion produced a black image; discarded and regenerated with macOS codec access outside the sandbox.
- SVG extraction used existing /Users/andrewcheng/mambaforge/bin/python with PyMuPDF 1.28.2. A redundant temporary dependency installation was canceled; no project dependencies were added.
- Added namespaced SVG IDs and data-series attributes only. All original path geometry remains unchanged.
- All 12 final SVGs render pixel-identically to mapped source SVGs at matching dimensions; report /private/tmp/andrew-website-papers/qa/svg-render-invariants.json.
- Independent scientific copy review found no substantive inaccuracies in titles, authors, statuses, source links, or summaries.
- Preserve existing CRLF in index.html; check with git -c core.whitespace=cr-at-eol diff --check.
- HTML/SVG checks passed: four explorers, local figure/style/script references present, unique IDs, and valid ARIA control targets.
- Chrome checks confirmed verification steps, dataset and method selection, batch-fraction selection, and curve highlighting. Native browser control was unreliable; the user's two-minute Chrome window ended before zoom and narrow-screen visual checks could be completed. Those visual checks remain unverified.
- Chrome exposed an existing Bootstrap integrity mismatch that prevented the navigation script from loading. Replaced the checksum with the SHA-384 of the exact Bootstrap 4.3.1 bundle and deferred the ordered jQuery/Bootstrap scripts.
- Playback now preloads/decodes the four original panels on request and begins each dwell after the displayed panel decodes. Cancellation tokens prevent stale loading from restarting playback. Reduced-motion preferences use manual stepping; modified Expand clicks preserve native link behavior.
- Final checks passed: `node --check assets/js/research-figures.js`, whitespace check above, and seven targeted playback/click behavioral checks. The behavioral check reproduced the old immediate-playback bug before validating the fix.
- Behavioral check command, run from the repository: `node /private/tmp/test-research-figure-loading.cjs assets/js/research-figures.js /private/tmp/research-figures-before-loading-fix.js`. Temporary QA artifacts retain the before/after evidence without adding project dependencies.
- Ready for commit/push; verify GitHub Pages reports the resulting commit built and serves matching HTML, scripts, styles, and figures.

## Revision — Figure 4 and simpler journal figures, 2026-11-13
- User requested the complete NeurIPS 2022 Figure 4, more visual appeal, working batch-fraction images, and removal of IMA and DGCP options. This supersedes the IMA dataset/series controls and DGCP walkthrough above.
- The user's open Chrome tab still pointed to the stopped localhost preview. This prevents uncached panel requests from completing. Publication handoff must use the permanent GitHub Pages address before preview teardown.
- The old momentum SVGs also embedded roughly 14 million raster pixels per panel. This is a verified memory-efficiency problem, not a separately confirmed cause of the reported browser failure.
- Replaced the displayed NeurIPS assets with direct, lossless PNG exports from the unchanged proceedings PDF. Complete Figure 4 is the default in a wider display; the four original convergence-rate panels remain available. No scientific values or colors were recreated. Exact crops, dimensions, and hashes are appended to images/research/provenance.json.
- IMA and DGCP now show static original figures with click-to-enlarge access and source links, without the previous option buttons.
- Fixed the existing template's globally forced white button text with a scoped color override, making the remaining research controls readable.
- Manual image selection now decodes before changing the displayed image, caption, or selected button. Failed requests retain the current image; rapid selections cancel stale results. Playback includes only the four marked fractions and excludes the full-figure overview.
- Checks passed: JavaScript syntax, CRLF-aware whitespace, local asset/ID/ARIA references, no IMA/DGCP buttons, full Figure 4 selected by default, four playback settings, and all five PNG signatures/dimensions/source hashes.
- Nine targeted behavior checks passed, including reproduction of the old premature image-swap bug, failure retention, successful atomic updates, selection races, cancellation, four-panel playback, reduced motion, initial overview preservation, and modified link clicks. Command: `node /private/tmp/test-research-panel-transactions.cjs assets/js/research-figures.js /private/tmp/research-figures-before-transactional-fix.js`.
- Browser limitation: the dedicated browser host is unavailable. Native Chrome showed the old page and unreadable controls, but subsequent page navigation returned blank captures and no page accessibility tree despite successful local HTML/script/style requests. New-layout visual QA is not established by those captures.

## Revision — Complete portfolio cleanup and two new preprints, 2026-11-13
- The user expanded the approved scope to add the linear RFM and Inner Jev papers, remove Recent Events, and make the whole website cleaner and slicker. This supersedes the earlier exclusion of a broader homepage redesign and additional papers.
- Replaced the legacy Bootstrap/jQuery page shell with semantic HTML and local CSS. Unified the header, biography, portrait, research entries, and footer around shared widths, restrained colors, serif headings, and responsive spacing. Removed the Recent Events section entirely. Preserved the existing biographical facts while shortening the copy; the original master's-student wording does not establish degree completion.
- Added a local favicon, metadata, skip navigation, visible keyboard focus, and reduced-motion handling. Kept the genuine JPEG portrait and original scientific figures. No new dependencies or generated scientific artwork were added.
- Added Releasing the Inner Jev: A Simple Recipe for Open Decision Models as a 2026 preprint, submitted 12 October 2026. Verified the title, author order, equal contribution, and paper-linked code/models/dataset resources against https://arxiv.org/abs/2610.17205 and the original v1 PDF. Figure 2 is a direct crop from PDF page 5; it compares zero-shot and trained capability, including the model whose mean decreases. https://arxiv.org/pdf/2610.17205v1
- Added Exact Dynamics and Finite-Sample Trajectory Recovery of Linear Recursive Feature Machines as a 2026 preprint, submitted 6 October 2026. Verified the title and author order against https://arxiv.org/abs/2610.09196 and the v1 PDF. The paper's placeholder proceedings header is not evidence of acceptance. No publication venue or unverified code link was added. https://arxiv.org/pdf/2610.09196v1
- RFM Figure 3's sample-complexity panel is the default, with the complete original figure available in the viewer. The caption identifies predictor discrepancy, the first 10 updates, and the median/10–90% band over 20 datasets. The complete-figure caption distinguishes a finite-dataset numerical endpoint from population prediction error. PDF crops, source hashes, and final asset hashes are recorded in images/research/provenance.json.
- Chrome visual QA is now established for this revision: inspected the desktop homepage and research layout; confirmed the portrait and original figures display; opened the RFM complete figure, selected 2× zoom, and closed with Escape; selected NeurIPS batch fraction 0.25 and confirmed its original plot renders in the viewer. The earlier blank captures remain an observation, not a diagnosis of their cause.
- Inspected the homepage, portrait, biography, and research section in Chrome's 390×844 responsive viewport. Text, navigation, images, and paper titles fit without visible clipping. Restored desktop mode and closed DevTools afterward.
- Static checks passed for six paper articles and six figure explorers, unique IDs, valid ARIA references, all local assets, complete document structure, unchanged JavaScript syntax, CSS parsing, and CRLF-aware whitespace. Verified the three new PNG signatures, dimensions, and provenance hashes. Shared body/control text contrast was checked against the page background.
- Publication procedure: commit the reviewed source/assets, push to the existing GitHub Pages repository, verify the build commit and live asset hashes, then move the preview tab to the permanent live URL before stopping the owned local server. Deployment evidence belongs in /private/tmp/andrew-website-papers/qa/portfolio-deployment.json.

## Revision — Figure 1 for both new papers, 2026-11-14
- The user requested Figure 1 for Exact Dynamics and Releasing the Inner Jev. This supersedes the displayed Figure 3 and Figure 2 choices above. The previous assets and provenance remain retained.
- Inner Jev now uses the complete original architecture from PDF page 2, displayed across the entry's width. Narrow screens can scroll horizontally through the unchanged diagram; the full figure remains available in the zoom viewer. The diagram's example probability is not a benchmark accuracy claim.
- Exact Dynamics now uses Figure 1 from PDF page 13. Original panels A and B are shown beside a readable HTML transcription of panel C. Manual buttons select only the source's t=0, 1, and 5 word lists; there is no interpolation, autoplay, or fabricated model output. All seven query examples are retained. The t=0 column is explicitly a random baseline, not learned neighbors. The authored t=5 table remains visible without JavaScript.
- The original complete Figure 1 opens by default when this figure is enlarged. Existing figure viewers retain their prior selected-panel default. Original PDF crops, dimensions, and hashes are appended under figure1_revision in images/research/provenance.json.
- Interpretation checks: A concerns stable rank of the floor-subtracted feature matrix, not literal matrix rank or accuracy. B concerns maximum operator-norm discrepancy over iterations 1–5 relative to a finite 10^9-example reference, not exact population truth. The selected text neighborhoods are illustrative examples, not an aggregate semantic-quality metric. These text experiments lie outside the theorem's isotropic sub-Gaussian setting.
- An independent PDF-block extraction confirmed all 105 words across 21 checkpoint/query lists, and the static HTML default, exactly match Figure 1C. Evidence: /private/tmp/andrew-website-papers/qa/rfm-figure1-words.json. Runtime checks passed for all seven rows at all three checkpoints, pressed states, labels, baseline/neighbor notes, live announcements, focus preservation, and incomplete-markup fallback: node /private/tmp/test-rfm-figure.cjs.
- The nine existing transactional panel/playback checks still pass; both scripts pass syntax checks. HTML IDs/ARIA/local assets, CSS parsing, whitespace, and all new source-image hashes passed.
- Chrome visually confirmed the full-width Inner Jev architecture, and the page accessibility state exposed the RFM random-baseline table and selected t=0 control. Further native interaction attempts were interrupted by concurrent window changes and one tool timeout. Do not describe this Figure 1 revision as fully visually checked on mobile; the preceding whole-site 390x844 check remains valid for that earlier revision.
- The preceding whole-site update was published as f7d4386214c33a36be5b03e1cb583d9a5727dd38; GitHub Pages reported built, and all 11 checked live assets matched local hashes. Evidence: /private/tmp/andrew-website-papers/qa/portfolio-deployment.json. Verify this Figure 1 revision independently after push, recording /private/tmp/andrew-website-papers/qa/figure1-deployment.json.

## Revision — Plain-language Exact Dynamics description, 2026-11-14
- At the user's request, rewrote the Exact Dynamics paper description around alternating ridge regression and AGOP feature updates, followed by feature evolution and sample requirements. Used the paper's term "multi-output regression."
- Checked the mechanism and scope against the original PDF abstract and introduction (pages 1–2). This is an explanation of the analyzed method, not a claim of a new algorithm. Figure captions, plots, and interactions are unchanged.
- Verified the exact text replacement and CRLF-aware whitespace; publish and verify the live HTML.
