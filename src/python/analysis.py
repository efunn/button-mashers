import numpy as np # just in case
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sea
import glob

all_data = '../../data/*.csv'
hoowoo_data = '../../data/*alklmao*.csv'

ds_data = hoowoo_data

ds_paths = glob.glob(ds_data)

ds_all = [pd.read_csv(ds_path) for ds_path in ds_paths]

ds = ds_all[1]

ds_aim = ds_all[0]
ds_timing = ds_all[1]
ds_aim = ds_aim[ds_aim.target_finger!='x'].reset_index(drop=True)
ds_timing = ds_timing[ds_timing.target_finger!='x'].reset_index(drop=True)
timing_window = 250
finger_list = ['l','r','m','i','t']

# ds = ds[ds.target_finger!='x'].reset_index(drop=True)
# (ds.target_finger == ds.pressed_finger).sum()/len(ds)
# (ds.target_finger == 'i').sum()/len(ds)

plt.ion()

# plt.hist(ds_aim.press_ms,alpha=0.5)
# plt.hist(ds_timing.press_ms,alpha=0.5)
# plt_y_max = 40
# plt.legend(['aim for target','press on time'])
# plt.plot([-0.5*timing_window,-0.5*timing_window],[0,plt_y_max],color='red')
# plt.plot([0.5*timing_window,0.5*timing_window],[0,plt_y_max],color='red')

# ds_aim = ds_aim[ds_aim.target_finger==ds_aim.pressed_finger]
# ds_aim['rt_ms'] = -0.5*timing_window+ds_aim.timing_ms+ds_aim.press_ms
# plt.hist(ds_aim.rt_ms)
# finger_list = ['l','r','m','i','t']
# for finger in finger_list:
#     print(finger+': '+str(ds_aim[ds_aim.pressed_finger==finger].rt_ms.median()))
# sea.catplot(data=ds_aim, x='pressed_finger', y='rt_ms', order=finger_list)

ds_aim = ds_aim[ds_aim.target_finger!=ds_aim.pressed_finger]
ds_aim['rt_ms'] = -0.5*timing_window+ds_aim.timing_ms+ds_aim.press_ms

press_mat = np.zeros((len(finger_list),len(finger_list)))
for idx, target_finger in enumerate(finger_list):
    for jdx, pressed_finger in enumerate(finger_list):
        press_mat[idx,jdx] = len(ds_aim[
            (ds_aim.target_finger==target_finger) & (ds_aim.pressed_finger==pressed_finger)])
sea.heatmap(press_mat, xticklabels=finger_list, yticklabels=finger_list)
plt.xlabel('pressed finger')
plt.ylabel('target finger')

ds_timing = ds_timing[ds_timing.target_finger!=ds_timing.pressed_finger]
ds_timing['rt_ms'] = -0.5*timing_window+ds_timing.timing_ms+ds_timing.press_ms
