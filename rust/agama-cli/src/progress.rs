use agama_lib::progress::{Progress, ProgressPresenter};
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};

pub struct InstallerProgress {
    progress: MultiProgress,
    bars: Vec<ProgressBar>,
}

impl InstallerProgress {
    pub fn new() -> Self {
        let progress = MultiProgress::new();
        Self {
            progress,
            bars: vec![],
        }
    }
}

impl ProgressPresenter for InstallerProgress {
    fn start(&mut self, progress: &[Progress]) {
        let style =
            ProgressStyle::with_template("{bar:40.green/white} {pos:>3}/{len:3} {msg}").unwrap();
        for info in progress.iter() {
            let bar = self.progress.add(ProgressBar::new(info.max_steps.into()));
            bar.set_style(style.clone());
            self.bars.push(bar);
        }
    }

    fn update(&mut self, progress: &[Progress]) {
        for (i, info) in progress.iter().enumerate() {
            let bar = &self.bars.get(i).unwrap();
            if info.finished {
                bar.finish_with_message("Done");
            } else {
                bar.set_length(info.max_steps.into());
                bar.set_position(info.current_step.into());
                bar.set_message(info.current_title.to_owned());
            }
        }
    }
}
