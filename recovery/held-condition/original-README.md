# Damped Pendulum Dataset

This repository provides a dataset for analyzing the motion of a damped single pendulum, capturing the effects of different types of resistance on its oscillatory behavior.

---

[//]: # (![len1_cond1_1]&#40;https://github.com/user-attachments/assets/939f8ea6-7b78-4c47-beaa-c8280b7ec99f&#41;)

![len1_cond1_1.png](cleaned_data_plot/len1_cond1_1.png)

Figure: Plot of [`cleaned_data/len1_cond1_1.csv`](cleaned_data/len1_cond1_1.csv).


[//]: # (https://github.com/user-attachments/assets/a0ffda1d-a318-46d4-8c0e-ed63720cd5e7)

[//]: # ()
[//]: # ()
[//]: # (Video: Example of Pendulum Dataset Collection Process. Using a wireless sensor paired with PASCO software, we recorded the pendulum’s angle and angular velocity.)

---

## Table of Contents

1. [Repository Structure](#repository-structure)
2. [Getting Started](#getting-started)
3. [Data Description](#data-description)
4. [Usage](#usage)
5. [Citing This Dataset](#citing-this-dataset)
6. [License](#license)
7. [Acknowledgments](#acknowledgments)
8. [Questions](#questions)


---

## Repository Structure

- **`raw_data/`**: Contains the unprocessed data collected from the pendulum experiments.
- **`cleaned_data/`**: Includes the processed and cleaned dataset ready for analysis.
- **`cleaned_data_plot/`**: Visualizations and plots derived from the cleaned data.
- **`column_names.py`**: Script defining the column names used in the datasets.
- **`pendulum_length.json`**: JSON file specifying the lengths of the pendulum used in different experiments.
- **`process.py`**: Script for processing the raw data into a cleaned format.
- **`.gitignore`**: Specifies files and directories to be ignored by Git.
- **`LICENSE`**: The license governing the use of this dataset.
- **`requirements.txt`**: Lists the Python dependencies required to process and analyze the data.

---

## Getting Started

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/EnzeXu/Damped_Pendulum_Dataset.git
   ```

2. **Analyze the Data**:
   Use the cleaned data in the `cleaned_data/` directory for your analysis. In the `cleaned_data_plot/` directory, you can view the patterns of each cleaned data file.

---

## Data Description

We conducted experiments with 5 pendulum lengths (see [pendulum_length.json](pendulum_length.json)), 3 different types of damping settings, and 3 repeated attempts for each setting combination. We collected both the angle and angular velocity using the Wireless Rotary Motion Sensor (PS-3220) powered by PASCO software.

Specifically, the pendulum length settings are:

1. 0.236 m
2. 0.330 m
3. 0.426 m
4. 0.518 m
5. 0.607 m

The damping settings are:

1. Air only
2. Air + small paper baffle
3. Air + large paper baffle

In each cleaned data file under the `cleaned_data/` directory, we provide 6,000 data entities. Each entity includes time (dt=0.01s), angle, angular velocity from the sensor, and the computed `is_peak` (Boolean) attribute to illustrate the peak points in the dynamics.

The experiments were conducted at approximately **37°16′15.16″ North, 76°42′26.66″ West**, where the gravitational acceleration is about **9.799 m/s²**.

---

## Usage

This dataset can be used for:

- Studying the effects of damping on pendulum motion.
- Validating physical models of damped harmonic oscillators.
- Developing and testing algorithms for time-series analysis.

---

## Citing This Dataset

If you use this dataset in your research, please cite our published paper. Below is a template in BibTeX format:

```bibtex
@article{xu2026identifying,
  title   = {Identifying Invariant Physical Dynamics Across Multiple Environments},
  author  = {Xu, Enze and Tran, Toon and Zhao, Hongjue and Wang, Yuchen and Huai, Mengdi and Shao, Huajie},
  journal = {Transactions on Machine Learning Research},
  issn    = {2835-8856},
  year    = {2026},
  url     = {https://openreview.net/forum?id=xvQYvYEGhj}
}
```

---

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

We would like to extend our sincere thanks to **Dr. Bjorg Larson**, and the **Physics Department of William & Mary** for allowing us to use their laboratory facilities to collect the datasets.

---

## Questions

For any questions or contributions, please feel free to open an issue or submit a pull request. Alternatively, you can contact us directly at [exu03@wm.edu](mailto:exu03@wm.edu).

---


