import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sea
import glob

hoowoo_data = '../../data/hoowoo/*.csv'

ds_paths = sorted(glob.glob(hoowoo_data))
ds_all = [pd.read_csv(ds_path) for ds_path in ds_paths]
ds = pd.concat(ds_all, ignore_index=True)

timing_window = 250
finger_list = ['l','r','m','i','t']
finger_idx = {f: i for i, f in enumerate(finger_list)}
impossible_ms = 299  # reaction time no human can hit; presses here are guesses

# real trials = a target existed; presses = the player actually hit something
ds_trial = ds[ds.target_finger != 'x'].reset_index(drop=True)
ds_press = ds_trial[ds_trial.pressed_finger != 'x'].reset_index(drop=True)

ds_press['possible'] = np.where(ds_press.timing_ms > impossible_ms, 'possible', 'impossible')
ds_press['target_i'] = ds_press.target_finger.map(finger_idx)
ds_press['pressed_i'] = ds_press.pressed_finger.map(finger_idx)
ds_press['offset'] = ds_press.pressed_i - ds_press.target_i  # + = toward thumb

ds_err = ds_press[ds_press.target_finger != ds_press.pressed_finger]

plt.ion()

# ---- error confusion: which finger gets pressed for which target ----
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
for ax, poss in zip(axes, ['possible', 'impossible']):
    sub = ds_err[ds_err.possible == poss]
    press_mat = np.zeros((len(finger_list), len(finger_list)))
    for idx, tf in enumerate(finger_list):
        for jdx, pf in enumerate(finger_list):
            press_mat[idx, jdx] = len(sub[(sub.target_finger == tf) & (sub.pressed_finger == pf)])
    sea.heatmap(press_mat, xticklabels=finger_list, yticklabels=finger_list,
                annot=True, fmt='.0f', cbar=False, ax=ax)
    ax.set_xlabel('pressed finger')
    ax.set_ylabel('target finger')
    ax.set_title('errors, ' + poss + ' trials (n=' + str(len(sub)) + ')')
fig.tight_layout()

# ---- error bias direction: adjacent-finger errors only ----
# only targets with a neighbor on both sides, else edge fingers force the direction
mid_fingers = finger_list[1:-1]
ds_adj = ds_err[(ds_err.offset.abs() == 1) & ds_err.target_finger.isin(mid_fingers)]
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
for poss in ['possible', 'impossible']:
    sub = ds_adj[ds_adj.possible == poss]
    axes[0].hist(sub.offset, bins=[-1.5, -0.5, 0.5, 1.5], alpha=0.5, density=True)
    print(poss + ' adjacent errors: ' + str((sub.offset > 0).sum()) + ' toward thumb, '
          + str((sub.offset < 0).sum()) + ' toward pinky, n=' + str(len(sub)) + ')')
axes[0].legend(['possible', 'impossible'])
axes[0].axvline(0, color='red')
axes[0].set_xticks([-1, 1], ['pinky side', 'thumb side'])
axes[0].set_ylabel('fraction of adjacent errors')
axes[0].set_title('net')

x = np.arange(len(mid_fingers))
for kdx, poss in enumerate(['possible', 'impossible']):
    sub = ds_adj[ds_adj.possible == poss]
    frac_thumb = [
        (sub[sub.target_finger == tf].offset > 0).mean() for tf in mid_fingers]
    axes[1].bar(x + (kdx - 0.5) * 0.4, frac_thumb, width=0.4, alpha=0.5, label=poss)
    for idx, tf in enumerate(mid_fingers):
        axes[1].text(x[idx] + (kdx - 0.5) * 0.4, 0.02,
                     'n=' + str((sub.target_finger == tf).sum()), ha='center', fontsize=8)
axes[1].axhline(0.5, color='red')
axes[1].set_xticks(x, mid_fingers)
axes[1].set_xlabel('target finger')
axes[1].set_ylabel('fraction toward thumb')
axes[1].legend()
axes[1].set_title('by finger')
fig.suptitle('error bias direction (adjacent errors, r/m/i targets)')
fig.tight_layout()

# ---- impossible trials: what do people press when they must guess ----
plt.figure()
imp = ds_press[ds_press.possible == 'impossible']
target_counts = imp.target_finger.value_counts().reindex(finger_list, fill_value=0)
press_counts = imp.pressed_finger.value_counts().reindex(finger_list, fill_value=0)
x = np.arange(len(finger_list))
plt.bar(x - 0.2, target_counts, width=0.4)
plt.bar(x + 0.2, press_counts, width=0.4)
plt.xticks(x, finger_list)
plt.legend(['target (counterbalanced)', 'pressed (the guess)'])
plt.xlabel('finger')
plt.ylabel('count')
plt.title('impossible (' + str(impossible_ms) + 'ms) trials: press distribution')

imp_all = ds_trial[ds_trial.timing_ms < impossible_ms]
n_miss = (imp_all.pressed_finger == 'x').sum()
print('impossible trials: ' + str(len(imp_all)) + ' total, ' + str(n_miss) + ' no-press, '
      + str((imp.target_finger == imp.pressed_finger).sum()) + ' lucky guesses ('
      + f'{(imp.target_finger == imp.pressed_finger).mean():.0%}' + ' of presses, chance 20%)')

# ---- press timing: guesses vs real reactions ----
plt.figure()
plt.hist(ds_press[ds_press.possible == 'possible'].press_ms, bins=20, alpha=0.5, density=True)
plt.hist(ds_press[ds_press.possible == 'impossible'].press_ms, bins=20, alpha=0.5, density=True)
plt.legend(['possible', 'impossible'])
plt.axvline(-0.5 * timing_window, color='red')
plt.axvline(0.5 * timing_window, color='red')
plt.xlabel('press_ms')
plt.title('press timing')

# ---- RTs: time from cue to press ----
ds_press['rt_ms'] = -0.5 * timing_window + ds_press.timing_ms + ds_press.press_ms
plt.figure()
for poss in ['possible', 'impossible']:
    sub = ds_press[ds_press.possible == poss]
    plt.hist(sub.rt_ms, bins=20, alpha=0.5, density=True)
    print(poss + ' RT: median ' + str(sub.rt_ms.median()) + 'ms (n=' + str(len(sub)) + ')')
plt.legend(['possible', 'impossible'])
plt.xlabel('rt_ms')
plt.ylabel('density')
plt.title('RTs')
