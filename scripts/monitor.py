#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
焦虑急救箱 - 每3天运营监控脚本
收集：GitHub Pages 状态、GitHub 仓库流量、飞书收款表记录，发送到飞书。
"""
import requests, json, os, datetime

FEISHU_APP_ID = os.getenv('FEISHU_APP_ID', '')
FEISHU_APP_SECRET = os.getenv('FEISHU_APP_SECRET', '')
OPEN_ID = os.getenv('FEISHU_OPEN_ID', '')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN') or os.popen('gh auth token').read().strip()
REPO = 'welch-wei/anxiety-kit'
BITABLE_APP_TOKEN = os.getenv('BITABLE_APP_TOKEN', '')
BITABLE_TABLE_ID = os.getenv('BITABLE_TABLE_ID', '')
PAGES_URL = 'https://welch-wei.github.io/anxiety-kit/'

def get_feishu_token():
    r = requests.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        json={'app_id': FEISHU_APP_ID, 'app_secret': FEISHU_APP_SECRET})
    return r.json()['tenant_access_token']

def send_feishu_text(text):
    token = get_feishu_token()
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    r = requests.post('https://open.feishu.cn/open-apis/im/v1/messages',
        headers=headers,
        params={'receive_id_type': 'open_id'},
        json={
            'receive_id': OPEN_ID,
            'msg_type': 'text',
            'content': json.dumps({'text': text})
        })
    return r.status_code, r.json()

def check_pages():
    try:
        r = requests.get(PAGES_URL, timeout=10)
        return '✅ 在线' if r.status_code == 200 else f'⚠️ 状态 {r.status_code}'
    except Exception as e:
        return f'❌ 访问异常: {e}'

def github_traffic():
    headers = {'Authorization': f'token {GITHUB_TOKEN}', 'Accept': 'application/vnd.github+json'}
    try:
        r = requests.get(f'https://api.github.com/repos/{REPO}/traffic/views', headers=headers)
        data = r.json()
        total = data.get('count', 0)
        uniques = data.get('uniques', 0)
        views = data.get('views', [])
        last_14 = views[-14:] if views else []
        recent = sum(v.get('count', 0) for v in last_14)
        recent_unique = sum(v.get('uniques', 0) for v in last_14)
        return total, uniques, recent, recent_unique
    except Exception as e:
        return 0, 0, 0, 0

def get_bitable_records():
    token = get_feishu_token()
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    try:
        r = requests.get(
            f'https://open.feishu.cn/open-apis/bitable/v1/apps/{BITABLE_APP_TOKEN}/tables/{BITABLE_TABLE_ID}/records',
            headers=headers,
            params={'page_size': 500}
        )
        data = r.json()
        items = data.get('data', {}).get('items', [])
        total_amount = 0.0
        pending = 0
        paid_count = 0
        for item in items:
            fields = item.get('fields', {})
            if not fields:
                continue
            try:
                amount = float(fields.get('金额', 0))
            except:
                amount = 0
            total_amount += amount
            status = fields.get('状态', '')
            if status == '待发放':
                pending += 1
            elif status == '已发放':
                paid_count += 1
        return len(items), total_amount, pending, paid_count
    except Exception as e:
        return 0, 0.0, 0, 0

def main():
    now = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    pages_status = check_pages()
    total, uniques, recent, recent_unique = github_traffic()
    record_count, total_amount, pending, paid_count = get_bitable_records()

    msg = f"""📊 焦虑急救箱运营简报 ({now})

{pages_status}
🔗 {PAGES_URL}

【访问】
· GitHub 仓库总浏览：{total} 次 / {uniques} 人
· 近14天浏览：{recent} 次 / {recent_unique} 人

【收款】
· 总订单数：{record_count}
· 累计收款：¥{total_amount:.2f}
· 待发放兑换码：{pending}
· 已发放：{paid_count}

📋 收款表：https://my.feishu.cn/base/{BITABLE_APP_TOKEN}
"""
    status, resp = send_feishu_text(msg)
    print(f"sent to feishu: {status}")
    print(resp)

if __name__ == '__main__':
    main()
