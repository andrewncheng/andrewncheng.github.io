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
